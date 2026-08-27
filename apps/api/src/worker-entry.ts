import { startWorker } from "./queue/worker";
import { QUEUE_NAME } from "./queue/scheduler";

const worker = startWorker();

console.log(`[worker] listening on queue "${QUEUE_NAME}"`);

async function shutdown() {
  console.log("[worker] shutting down...");
  await worker.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
