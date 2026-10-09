import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { pool } from "./db";
import { config } from "./config";
import { requireAuth } from "./auth";
import { scheduleBatch } from "./scheduler";
import { searchEmailIds } from "./search";

export const api = Router();

const scheduleSchema = z.object({
  subject: z.string().trim().min(1),
  body: z.string().trim().min(1),
  emails: z.array(z.string().email()).min(1).max(50000),
  startTime: z.coerce.date(),
  delayMs: z.number().int().min(0).max(3_600_000),
  hourlyLimit: z.number().int().min(1).max(100000),
});

api.get("/me", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, email, name, avatar FROM users WHERE id=$1",
    [req.userId]
  );
  rows[0] ? res.json(rows[0]) : res.status(401).json({ error: "Not signed in" });
});

api.post("/schedule", requireAuth, async (req, res) => {
  const parsed = scheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
  }
  const emails = [...new Set(parsed.data.emails.map((e) => e.toLowerCase()))];
  const result = await scheduleBatch(req.userId!, { ...parsed.data, emails });
  res.status(201).json(result);
});

api.get("/emails", requireAuth, async (req, res) => {
  const kind = req.query.status === "sent" ? "sent" : "scheduled";
  const statuses = kind === "sent" ? ["sent", "failed"] : ["scheduled", "sending"];
  const q = String(req.query.q ?? "").trim();

  let ids: string[] | null = null;
  if (q) ids = await searchEmailIds(req.userId!, q); // Elasticsearch

  const params: unknown[] = [req.userId, statuses];
  let where = "e.user_id=$1 AND e.status = ANY($2)";
  if (ids) {
    params.push(ids);
    where += ` AND e.id = ANY($${params.length}::uuid[])`;
  } else if (q) {
    params.push(`%${q}%`);
    where += ` AND (e.to_email ILIKE $${params.length} OR e.subject ILIKE $${params.length})`;
  }
  const order = kind === "sent" ? "e.sent_at DESC NULLS LAST" : "e.scheduled_at ASC";
  const { rows } = await pool.query(
    `SELECT e.id, e.to_email, e.subject, e.status, e.scheduled_at, e.sent_at,
            e.error, e.preview_url, s.email AS sender_email
     FROM emails e JOIN senders s ON s.id = e.sender_id
     WHERE ${where} ORDER BY ${order} LIMIT 500`,
    params
  );
  res.json(rows);
});

// ---- Slack OAuth (per-user webhook) ----
api.get("/slack/connect", requireAuth, (req, res) => {
  const state = jwt.sign({ uid: req.userId, p: "slack" }, config.jwtSecret, { expiresIn: "10m" });
  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id", config.slack.clientId);
  url.searchParams.set("scope", "incoming-webhook");
  url.searchParams.set("redirect_uri", config.slack.redirectUri);
  url.searchParams.set("state", state);
  res.redirect(url.toString());
});

api.get("/slack/callback", async (req, res) => {
  try {
    const { uid } = jwt.verify(String(req.query.state), config.jwtSecret) as { uid: string };
    const resp = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.slack.clientId,
        client_secret: config.slack.clientSecret,
        code: String(req.query.code),
        redirect_uri: config.slack.redirectUri,
      }),
    });
    const data = (await resp.json()) as {
      ok: boolean;
      error?: string;
      incoming_webhook?: { url: string; channel: string };
      team?: { name: string };
    };
    if (!data.ok || !data.incoming_webhook) throw new Error(data.error ?? "no webhook returned");
    await pool.query(
      "UPDATE users SET slack_webhook_url=$2, slack_channel=$3, slack_team=$4 WHERE id=$1",
      [uid, data.incoming_webhook.url, data.incoming_webhook.channel, data.team?.name ?? null]
    );
    res.redirect(`${config.frontendUrl}?slack=connected`);
  } catch (err) {
    console.error("[slack] oauth failed:", (err as Error).message);
    res.redirect(`${config.frontendUrl}?slack=error`);
  }
});

api.get("/slack/status", requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    "SELECT slack_webhook_url, slack_channel, slack_team FROM users WHERE id=$1",
    [req.userId]
  );
  const u = rows[0];
  res.json({
    connected: !!u?.slack_webhook_url,
    channel: u?.slack_channel ?? null,
    team: u?.slack_team ?? null,
  });
});

api.delete("/slack", requireAuth, async (req, res) => {
  await pool.query(
    "UPDATE users SET slack_webhook_url=NULL, slack_channel=NULL, slack_team=NULL WHERE id=$1",
    [req.userId]
  );
  res.json({ ok: true });
});
