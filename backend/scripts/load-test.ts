import "dotenv/config";
import { migrate, pool } from "../src/db";
import { redis } from "../src/redis";
import { scheduleBatch } from "../src/scheduler";

// Schedules 1000 emails for the same instant with a 100/hour cap per sender and prints
// how the Redis counters spread them over upcoming hour windows. Nothing is dropped.
(async () => {
  await migrate();
  const { rows } = await pool.query(
    `INSERT INTO users (google_id, email, name) VALUES ('load-test','load@test.dev','Load Test')
     ON CONFLICT (google_id) DO UPDATE SET name=EXCLUDED.name RETURNING id`
  );
  const emails = Array.from({ length: 1000 }, (_, i) => `lead${i}@example.com`);
  const { count } = await scheduleBatch(rows[0].id, {
    subject: "Load test", body: "<p>hello</p>", emails,
    startTime: new Date(), delayMs: 0, hourlyLimit: 100,
  });
  console.log(`Scheduled ${count} emails. Letting the worker run for 60s...`);
  await new Promise((r) => setTimeout(r, 60_000));
  const keys = (await redis.keys("rl:*")).sort();
  for (const k of keys) console.log(k, await redis.get(k));
  process.exit(0);
})();
