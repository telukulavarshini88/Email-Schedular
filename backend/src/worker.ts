import { Worker, DelayedError, Job } from "bullmq";
import { redis } from "./redis";
import { pool } from "./db";
import { config } from "./config";
import { QUEUE_NAME, EmailJobData } from "./queue";
import { getTransport } from "./senders";
import { indexEmail } from "./search";
import { notifySlackRateLimit } from "./slack";
import nodemailer from "nodemailer";

const HOUR = 3_600_000;

/**
 * Atomically reserve a send slot for a sender. Starting at the current hour window,
 * INCR the per-sender counter; if the window is full, roll into the next one until
 * a window with capacity is found. Returns [window, positionInWindow].
 * Runs as one Lua script, so it is safe across any number of workers/instances.
 */
const RESERVE_SLOT = `
local w = tonumber(ARGV[1]); local max = tonumber(ARGV[2])
while true do
  local k = KEYS[1] .. ':' .. w
  local c = redis.call('INCR', k)
  redis.call('EXPIRE', k, 604800)
  if c <= max then return {w, c} end
  w = w + 1
end`;

async function process(job: Job<EmailJobData>, token?: string) {
  const { emailId } = job.data;
  const { rows } = await pool.query(
    `SELECT e.*, s.email AS sender_email
     FROM emails e JOIN senders s ON s.id = e.sender_id WHERE e.id=$1`,
    [emailId]
  );
  const email = rows[0];
  // Idempotency check #1: already sent / failed / being sent -> nothing to do
  if (!email || email.status !== "scheduled") return;

  // 1) Hourly rate limit, per sender, Redis-backed
  const nowWindow = Math.floor(Date.now() / HOUR);
  if (job.data.slot !== nowWindow) {
    const [win, pos] = (await redis.eval(
      RESERVE_SLOT, 1, `rl:${email.sender_id}`, nowWindow, email.hourly_limit
    )) as [number, number];
    await job.updateData({ emailId, slot: win });

    if (win > nowWindow) {
      // Limit hit: never drop or fail. Push the job into the window it was assigned,
      // staggered by its position so original order is preserved as much as possible.
      if (pos === 1) {
        await notifySlackRateLimit(
          email.user_id, email.sender_id, email.sender_email, email.hourly_limit, win
        );
      }
      await job.moveToDelayed(win * HOUR + (pos - 1) * config.worker.minDelayMs, token);
      throw new DelayedError();
    }
  }

  // 2) Idempotency check #2: atomically claim the row so exactly one worker sends it
  const claim = await pool.query(
    `UPDATE emails SET status='sending', attempts=attempts+1, updated_at=now()
     WHERE id=$1 AND status='scheduled' RETURNING attempts`,
    [emailId]
  );
  if (!claim.rowCount) return;
  const attempts: number = claim.rows[0].attempts;

  // 3) Send through the sender's Ethereal SMTP account
  try {
    const transport = await getTransport(email.sender_id);
    const info = await transport.sendMail({
      from: email.sender_email,
      to: email.to_email,
      subject: email.subject,
      html: email.body,
    });
    await pool.query(
      `UPDATE emails SET status='sent', sent_at=now(), updated_at=now(),
         preview_url=$2, error=NULL WHERE id=$1`,
      [emailId, nodemailer.getTestMessageUrl(info) || null]
    );
  } catch (err) {
    const message = (err as Error).message;
    if (attempts < config.maxSendAttempts) {
      // hand back to BullMQ for a retry with backoff
      await pool.query(
        "UPDATE emails SET status='scheduled', error=$2, updated_at=now() WHERE id=$1",
        [emailId, message]
      );
      throw err;
    }
    await pool.query(
      "UPDATE emails SET status='failed', error=$2, updated_at=now() WHERE id=$1",
      [emailId, message]
    );
  }
  await indexEmail(emailId);
}

export function startWorker() {
  const worker = new Worker<EmailJobData>(QUEUE_NAME, process, {
    connection: redis,
    concurrency: config.worker.concurrency,
    // minimum gap between sends across this worker (mimics provider throttling)
    limiter: { max: 1, duration: config.worker.minDelayMs },
  });
  worker.on("failed", (job, err) => console.warn(`[worker] job ${job?.id} failed:`, err.message));
  worker.on("error", (err) => console.error("[worker] error:", err.message));
  console.log(
    `[worker] started (concurrency=${config.worker.concurrency}, ` +
      `minDelay=${config.worker.minDelayMs}ms)`
  );
  return worker;
}
