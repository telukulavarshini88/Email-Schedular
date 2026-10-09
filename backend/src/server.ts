import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { config } from "./config";
import { migrate } from "./db";
import { authRouter, requireAuth } from "./auth";
import { api } from "./routes";
import { emailQueue } from "./queue";
import { recover } from "./scheduler";
import { startWorker } from "./worker";

async function main() {
  await migrate();

  const app = express();
  app.use(cors({ origin: config.frontendUrl, credentials: true }));
  app.use(express.json({ limit: "10mb" }));
  app.use(cookieParser());

  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use("/auth", authRouter);
  app.use("/api", api);

  // Live BullMQ dashboard
  const board = new ExpressAdapter();
  board.setBasePath("/admin/queues");
  createBullBoard({
    // cast: bull-board's types lag behind BullMQ 5's job progress typing
    queues: [new BullMQAdapter(emailQueue) as any],
    serverAdapter: board,
  });
  app.use("/admin/queues", requireAuth, board.getRouter());

  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Something went wrong on our side" });
  });

  await recover();
  const worker = config.worker.embed ? startWorker() : null;

  const server = app.listen(config.port, () =>
    console.log(`[api] http://localhost:${config.port}  (queue dashboard: /admin/queues)`)
  );

  const stop = async () => {
    server.close();
    await worker?.close();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
