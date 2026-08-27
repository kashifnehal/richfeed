import cors from "@fastify/cors";
import Fastify from "fastify";
import type { Platform } from "@richfeed/shared";

/**
 * Wiring proof: shared domain types resolve inside the API too.
 * Not used at runtime yet — platform integrations come in a later step.
 */
const SUPPORTED_PLATFORMS: readonly Platform[] = [
  "instagram",
  "facebook",
  "twitter",
  "linkedin_personal",
  "linkedin_org",
  "tiktok",
  "youtube",
  "pinterest",
  "threads",
  "reddit",
];

const app = Fastify({ logger: true });

await app.register(cors, { origin: "http://localhost:3000" });

app.get("/health", async () => ({
  status: "ok",
  timestamp: new Date().toISOString(),
}));

const port = Number(process.env.PORT ?? 4000);

try {
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(
    `API listening on http://localhost:${port} (${SUPPORTED_PLATFORMS.length} platforms known)`,
  );
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
