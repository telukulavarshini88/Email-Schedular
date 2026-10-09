import { pool } from "./db";
import { emailQueue, jobFor } from "./queue";
import { ensureSenders } from "./senders";
import { indexMany } from "./search";

export interface ScheduleInput {
  subject: string;
  body: string;
  emails: string[];
  startTime: Date;
  delayMs: number;
  hourlyLimit: number;
}

/**
 * Persists every email to Postgres (source of truth) and enqueues one BullMQ
 * delayed job per email. Emails are spread over the user's senders round-robin
 * and spaced `delayMs` apart starting at `startTime`.
 */
export async function scheduleBatch(userId: string, input: ScheduleInput) {
  const senders = await ensureSenders(userId);
  const { emails, startTime, delayMs } = input;

  const senderIds = emails.map((_, i) => senders[i % senders.length].id);
  const times = emails.map((_, i) => new Date(startTime.getTime() + i * delayMs));

  const inserted = await pool.query<{ id: string; scheduled_at: Date }>(
    `INSERT INTO emails (user_id, sender_id, to_email, subject, body, scheduled_at, hourly_limit, delay_ms)
     SELECT $1, t.sender_id, t.to_email, $2, $3, t.scheduled_at, $4, $5
     FROM unnest($6::uuid[], $7::text[], $8::timestamptz[]) AS t(sender_id, to_email, scheduled_at)
     RETURNING id, scheduled_at`,
    [userId, input.subject, input.body, input.hourlyLimit, delayMs, senderIds, emails, times]
  );

  await emailQueue.addBulk(inserted.rows.map((r) => jobFor(r.id, r.scheduled_at)));
  // index in the background; failures never block scheduling
  void indexMany(inserted.rows.map((r) => r.id));
  return { count: inserted.rowCount ?? 0 };
}

/**
 * Boot-time reconciliation. Redis already persists delayed jobs, so normally this
 * is a no-op. It heals two edge cases: a crash mid-send (rows stuck in 'sending')
 * and a wiped Redis (scheduled rows with no job).
 */
export async function recover() {
  await pool.query(
    `UPDATE emails SET status='scheduled', updated_at=now()
     WHERE status='sending' AND updated_at < now() - interval '5 minutes'`
  );
  const { rows } = await pool.query<{ id: string; scheduled_at: Date }>(
    "SELECT id, scheduled_at FROM emails WHERE status='scheduled'"
  );
  let restored = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const jobs = await Promise.all(chunk.map((r) => emailQueue.getJob(r.id)));
    const missing = chunk.filter((_, idx) => !jobs[idx]);
    if (missing.length) {
      await emailQueue.addBulk(missing.map((r) => jobFor(r.id, r.scheduled_at)));
      restored += missing.length;
    }
  }
  console.log(`[recover] ${rows.length} scheduled emails checked, ${restored} re-enqueued`);
}
