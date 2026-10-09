import "dotenv/config";

const num = (key: string, fallback: number) => Number(process.env[key] ?? fallback);

export const config = {
  port: num("PORT", 4000),
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",
  backendUrl: process.env.BACKEND_URL ?? "http://localhost:4000",
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret",
  databaseUrl:
    process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/reachinbox",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  elasticUrl: process.env.ELASTICSEARCH_URL ?? "http://localhost:9200",
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  },
  slack: {
    clientId: process.env.SLACK_CLIENT_ID ?? "",
    clientSecret: process.env.SLACK_CLIENT_SECRET ?? "",
    redirectUri:
      process.env.SLACK_REDIRECT_URI ??
      `${process.env.BACKEND_URL ?? "http://localhost:4000"}/api/slack/callback`,
  },
  worker: {
    concurrency: num("WORKER_CONCURRENCY", 5),
    minDelayMs: num("MIN_DELAY_BETWEEN_EMAILS_MS", 2000),
    embed: process.env.EMBED_WORKER !== "false",
  },
  defaultHourlyLimit: num("MAX_EMAILS_PER_HOUR_PER_SENDER", 200),
  sendersPerUser: num("SENDERS_PER_USER", 3),
  maxSendAttempts: 3,
};
