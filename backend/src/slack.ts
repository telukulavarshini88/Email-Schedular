import { pool } from "./db";
import { redis } from "./redis";

/**
 * Posts to the user's connected Slack (incoming webhook obtained through OAuth).
 * - Not connected -> silently does nothing (and releases the dedupe key so a later
 *   connection can notify on the next limit hit, no redeploy needed).
 * - Deduped to one message per sender per hour window.
 */
export async function notifySlackRateLimit(
  userId: string,
  senderId: string,
  senderEmail: string,
  limit: number,
  nextWindow: number
) {
  try {
    const key = `slack:notified:${senderId}:${nextWindow}`;
    const first = await redis.set(key, "1", "EX", 7200, "NX");
    if (!first) return;

    const { rows } = await pool.query(
      "SELECT slack_webhook_url FROM users WHERE id=$1",
      [userId]
    );
    const url: string | null = rows[0]?.slack_webhook_url ?? null;
    if (!url) {
      await redis.del(key);
      return;
    }
    const resumes = new Date(nextWindow * 3_600_000).toLocaleTimeString();
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text:
          `:warning: *Hourly send limit reached* for sender \`${senderEmail}\` ` +
          `(${limit}/hour). Remaining emails were rescheduled and resume at ${resumes}.`,
      }),
    });
    if (!res.ok) console.warn("[slack] webhook responded", res.status);
  } catch (err) {
    console.warn("[slack] notify failed:", (err as Error).message);
  }
}
