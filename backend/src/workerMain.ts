import { migrate } from "./db";
import { recover } from "./scheduler";
import { startWorker } from "./worker";

// Standalone worker process: run as many of these as you like (EMBED_WORKER=false on the API).
(async () => {
  await migrate();
  await recover();
  const worker = startWorker();
  const stop = async () => { await worker.close(); process.exit(0); };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
})();
