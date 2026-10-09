import nodemailer, { Transporter } from "nodemailer";
import { pool } from "./db";
import { config } from "./config";

export interface Sender {
  id: string;
  email: string;
}

const transports = new Map<string, Transporter>();

/** Make sure the user has N Ethereal (fake SMTP) sender accounts; creates missing ones. */
export async function ensureSenders(userId: string): Promise<Sender[]> {
  const existing = await pool.query<Sender>(
    "SELECT id, email FROM senders WHERE user_id=$1 ORDER BY created_at",
    [userId]
  );
  const missing = config.sendersPerUser - existing.rowCount!;
  for (let i = 0; i < missing; i++) {
    const acc = await nodemailer.createTestAccount();
    await pool.query(
      `INSERT INTO senders (user_id, email, smtp_host, smtp_port, smtp_user, smtp_pass)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [userId, acc.user, acc.smtp.host, acc.smtp.port, acc.user, acc.pass]
    );
  }
  if (missing <= 0) return existing.rows;
  const all = await pool.query<Sender>(
    "SELECT id, email FROM senders WHERE user_id=$1 ORDER BY created_at",
    [userId]
  );
  return all.rows;
}

export async function getTransport(senderId: string): Promise<Transporter> {
  const cached = transports.get(senderId);
  if (cached) return cached;
  const { rows } = await pool.query(
    "SELECT smtp_host, smtp_port, smtp_user, smtp_pass FROM senders WHERE id=$1",
    [senderId]
  );
  if (!rows[0]) throw new Error(`Sender ${senderId} not found`);
  const t = nodemailer.createTransport({
    host: rows[0].smtp_host,
    port: rows[0].smtp_port,
    secure: false,
    auth: { user: rows[0].smtp_user, pass: rows[0].smtp_pass },
  });
  transports.set(senderId, t);
  return t;
}
