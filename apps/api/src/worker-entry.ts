import { getSupabaseClient } from "./db/supabase";
import { startWorker } from "./queue/worker";
import { QUEUE_NAME } from "./queue/scheduler";

const worker = startWorker();

console.log(`[worker] listening on queue "${QUEUE_NAME}"`);

// Supabase's free tier pauses a project after 7 days without database
// activity. The always-on worker runs one tiny query every 12h so a quiet
// week with no posts doesn't take the database down; the Vercel cron at
// apps/web/app/api/keepalive is the backup if this service is ever off.
const HEARTBEAT_INTERVAL_MS = 12 * 60 * 60 * 1000;

async function supabaseHeartbeat() {
  try {
    const { error } = await getSupabaseClient().from("workspaces").select("id").limit(1);
    if (error) throw error;
    console.log("[worker] supabase heartbeat ok");
  } catch (err) {
    console.error(`[worker] supabase heartbeat failed: ${(err as { message?: string }).message ?? String(err)}`);
  }
}

void supabaseHeartbeat();
const heartbeat = setInterval(() => void supabaseHeartbeat(), HEARTBEAT_INTERVAL_MS);

async function shutdown() {
  console.log("[worker] shutting down...");
  clearInterval(heartbeat);
  await worker.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
