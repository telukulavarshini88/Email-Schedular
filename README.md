# ReachInbox Hiring Assignment: Email Job Scheduler

A production-style email scheduler: Express + TypeScript API, **BullMQ + Redis** delayed jobs (no cron), Postgres as source of truth, **Ethereal** fake SMTP with multiple senders, **Elasticsearch** search, a live **Bull Board** dashboard, Google login, Slack alerts, and a React + Tailwind dashboard.

## Quick start

Requires Node 20+ and Docker.

```bash
docker compose up -d            # Postgres, Redis (AOF on), Elasticsearch

# backend
cd backend
cp .env.example .env            # fill in Google (and Slack) credentials
npm install
npm run dev                     # API + embedded worker on :4000

# frontend (new terminal)
cd frontend
npm install
npm run dev                     # http://localhost:5173
```

To scale workers separately: set `EMBED_WORKER=false` on the API and run `npm run worker` in as many terminals as you like.

### Environment setup

| What | How |
|---|---|
| **Ethereal** | Nothing to configure. On first login the backend calls `nodemailer.createTestAccount()` to create `SENDERS_PER_USER` (default 3) Ethereal SMTP accounts and stores them in the `senders` table. Emails are spread round-robin across them. Each sent email stores an Ethereal **Preview** link, shown in the Sent tab. |
| **Google login** | Google Cloud Console → OAuth client (Web). Authorized redirect URI: `http://localhost:4000/auth/google/callback`. Set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`. |
| **Slack** | Create a Slack app → *OAuth & Permissions* → scope `incoming-webhook`. Slack requires an **https** redirect URL, so run `ngrok http 4000` and add `https://<id>.ngrok.app/api/slack/callback` to the app. Set it as `SLACK_REDIRECT_URI`, plus `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET`. Click **Connect Slack** in the header. |
| **All variables** | See `backend/.env.example`. |

## Architecture

```
React dashboard ─► Express API ─► Postgres (emails, senders, users)
                      │
                      ├─► BullMQ queue "emails" (Redis)  ◄── Worker(s)
                      │        one delayed job per email,        ├─► Ethereal SMTP
                      │        jobId = email.id                  ├─► Elasticsearch index
                      │                                          └─► Slack webhook (limit hit)
                      └─► /admin/queues  (Bull Board, live)
```

### How scheduling works
`POST /api/schedule` validates the request, inserts one row per lead into Postgres (`status='scheduled'`), then enqueues one **BullMQ delayed job** per row with `delay = scheduledAt - now`. Lead *i* is scheduled at `startTime + i × delay`. Leads are de-duplicated and assigned to senders round-robin. There is no cron anywhere.

### How persistence on restart works
Delayed jobs live in Redis (AOF enabled in `docker-compose.yml`) and rows live in Postgres. When the server or worker restarts, the BullMQ worker re-attaches to the same queue and future jobs fire at their original time. Nothing is re-created. On boot, `recover()` also:
- resets rows stuck in `sending` for over 5 minutes (a crash mid-send), and
- re-enqueues any `scheduled` row that has no job (e.g. Redis was wiped).

Because `jobId = email.id`, re-enqueueing an existing email is a no-op.

### Idempotency (no duplicate sends)
Three layers: (1) `jobId = email.id`, so one job per email; (2) the worker skips any email whose status isn't `scheduled`; (3) the worker claims the row with `UPDATE … WHERE status='scheduled' RETURNING`, so only one worker can win it, even with many workers.

### Concurrency and minimum delay
- `WORKER_CONCURRENCY` (default 5) sets parallel jobs per worker process. State is protected by the atomic claim above.
- **Minimum delay between sends: 2 seconds** (`MIN_DELAY_BETWEEN_EMAILS_MS=2000`) via the BullMQ `limiter` (`max:1, duration:2000`), mimicking provider throttling. The user's "delay between emails" in the compose form additionally spaces out the scheduled times.

### Hourly rate limiting
- Limit is configurable: default `MAX_EMAILS_PER_HOUR_PER_SENDER=200`, overridable per batch from the compose form (stored on each row).
- Before sending, the worker runs a **Redis Lua script** that atomically `INCR`s a counter keyed `rl:<sender>:<hourWindow>`. If that window is full it rolls into the next window until it finds capacity. Because it's a single atomic script in Redis, it is safe across any number of workers or instances.
- When the limit is hit the job is **never dropped or failed**. It is moved with `moveToDelayed` into the window it was assigned, staggered by its position (`windowStart + position × minDelay`), which preserves order as much as possible. The assigned window is saved in the job data so a rescheduled job doesn't consume a second slot.
- **Slack:** on the first overflow into a new window, the worker posts a message to the user's connected Slack (deduped per sender per window). If Slack isn't connected nothing happens and nothing crashes. The webhook is read from the DB on each hit, so connecting later works without a redeploy.

### Behavior under load (1000+ emails at once)
All 1000 jobs become ready together. The 2s limiter paces sends; each job reserves a slot, and anything past a sender's cap is rolled to the next hour window(s). With 3 senders at 100/hour, 1000 emails drain over about four hours, with no loss and no duplicates. Try it: `cd backend && npm run load-test`, then watch `/admin/queues`.

### Search
Every scheduled and sent email is indexed in Elasticsearch (on schedule and again on status change). The dashboard search box queries it (fuzzy over email, subject and body). If Elasticsearch is down, the API falls back to a SQL `ILIKE`, so the dashboard keeps working.

## Features implemented

**Backend:** scheduling API, BullMQ delayed jobs (no cron), Postgres persistence, restart recovery, idempotency, configurable worker concurrency, minimum send delay, Redis-backed hourly limits with overflow rescheduling, multiple Ethereal senders, retries with exponential backoff, Elasticsearch indexing + search, Bull Board at `/admin/queues`, Google OAuth, Slack OAuth + live notification.

**Frontend:** Google login, header with name / email / avatar and logout, Scheduled and Sent tabs, Compose modal (subject, body, CSV/text upload with detected-address count, start time, delay, hourly limit), tables with loading and empty states, toasts for errors, search, Slack connect / disconnect, auto-refresh every 8 seconds. Reusable UI components live in `frontend/src/components/ui`.

## Demo script (≤ 5 min)
1. Log in with Google; connect Slack.
2. Compose: upload a leads CSV, start in 1–2 minutes, hourly limit 5, schedule. Show the Scheduled tab and `/admin/queues`.
3. Stop the backend (Ctrl+C), start it again, and show the emails still send on time with no duplicates.
4. Show the hourly limit hit: the Slack message arrives and the remaining jobs show as delayed to the next hour.
5. Open an Ethereal preview link from the Sent tab.

## Assumptions, shortcuts and trade-offs
- **The UI follows the described layout, not the Figma pixel for pixel.** I didn't have the Figma file; adjust spacing and colors in `tailwind.config.js` and the components.
- The BullMQ `limiter` is per queue (global), so it sets the minimum gap; the per-sender hourly cap comes from the Redis counters.
- The Lua script builds key names dynamically, which is fine on a single Redis. Redis Cluster would need hash tags.
- Delivery is at-least-once in the narrow case where a process dies after the SMTP call but before the DB update; the 5-minute recovery then retries. In normal operation each email is sent once.
- Ethereal credentials are stored in plain text (they are throwaway test accounts). Slack webhook URLs are stored per user; encrypt them at rest in production.
- The Bull Board dashboard requires a logged-in session but isn't role-restricted.
