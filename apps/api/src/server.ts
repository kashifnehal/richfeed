import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import { accountsRoutes } from "./routes/accounts";
import { dashboardRoutes } from "./routes/dashboard";
import { mediaRoutes } from "./routes/media";
import { postsRoutes } from "./routes/posts";

const app = Fastify({ logger: true });

await app.register(cors, { origin: "http://localhost:3000" });
await app.register(multipart);

app.get("/health", async () => ({
  status: "ok",
  timestamp: new Date().toISOString(),
}));

await app.register(accountsRoutes);
await app.register(postsRoutes);
await app.register(dashboardRoutes);
await app.register(mediaRoutes);

const port = Number(process.env.PORT ?? 4000);

try {
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`API listening on http://localhost:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
