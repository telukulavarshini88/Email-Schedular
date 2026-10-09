import { Router, Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { pool } from "./db";
import { config } from "./config";
import { ensureSenders } from "./senders";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

const google = new OAuth2Client(
  config.google.clientId,
  config.google.clientSecret,
  `${config.backendUrl}/auth/google/callback`
);

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.cookies?.token as string | undefined;
    if (!token) throw new Error("no token");
    req.userId = (jwt.verify(token, config.jwtSecret) as { uid: string }).uid;
    next();
  } catch {
    res.status(401).json({ error: "Not signed in" });
  }
}

export const authRouter = Router();

authRouter.get("/google", (_req, res) => {
  res.redirect(
    google.generateAuthUrl({ scope: ["openid", "email", "profile"], prompt: "select_account" })
  );
});

authRouter.get("/google/callback", async (req, res) => {
  try {
    const { tokens } = await google.getToken(String(req.query.code));
    const ticket = await google.verifyIdToken({
      idToken: tokens.id_token!,
      audience: config.google.clientId,
    });
    const p = ticket.getPayload()!;
    const { rows } = await pool.query(
      `INSERT INTO users (google_id, email, name, avatar) VALUES ($1,$2,$3,$4)
       ON CONFLICT (google_id) DO UPDATE SET email=EXCLUDED.email, name=EXCLUDED.name, avatar=EXCLUDED.avatar
       RETURNING id`,
      [p.sub, p.email, p.name, p.picture]
    );
    const uid: string = rows[0].id;
    ensureSenders(uid).catch((e) => console.warn("[senders]", e.message));
    res.cookie("token", jwt.sign({ uid }, config.jwtSecret, { expiresIn: "7d" }), {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 3600 * 1000,
    });
    res.redirect(config.frontendUrl);
  } catch (err) {
    console.error("[auth] google callback failed:", (err as Error).message);
    res.redirect(`${config.frontendUrl}?error=login_failed`);
  }
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie("token");
  res.json({ ok: true });
});
