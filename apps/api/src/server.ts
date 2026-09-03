import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import { frontendOrigin } from "./lib/frontend-origin";
import { accountsRoutes } from "./routes/accounts";
import { dashboardRoutes } from "./routes/dashboard";
import { mediaRoutes } from "./routes/media";
import { notificationsRoutes } from "./routes/notifications";
import { oauthConnectTicketRoutes } from "./routes/oauth-connect-ticket";
import { oauthFacebookRoutes } from "./routes/oauth-facebook";
import { oauthInstagramRoutes } from "./routes/oauth-instagram";
import { oauthLinkedInRoutes } from "./routes/oauth-linkedin";
import { oauthThreadsRoutes } from "./routes/oauth-threads";
import { oauthXRoutes } from "./routes/oauth-x";
import { oauthYouTubeRoutes } from "./routes/oauth-youtube";
import { postsRoutes } from "./routes/posts";
import { workspaceRoutes } from "./routes/workspace";

const app = Fastify({ logger: true });

await app.register(cors, { origin: frontendOrigin() });
await app.register(multipart);

app.get("/health", async () => ({
  status: "ok",
  timestamp: new Date().toISOString(),
}));

await app.register(accountsRoutes);
await app.register(postsRoutes);
await app.register(dashboardRoutes);
await app.register(mediaRoutes);
await app.register(workspaceRoutes);
await app.register(notificationsRoutes);
await app.register(oauthConnectTicketRoutes);
await app.register(oauthXRoutes);
await app.register(oauthFacebookRoutes);
await app.register(oauthInstagramRoutes);
await app.register(oauthThreadsRoutes);
await app.register(oauthLinkedInRoutes);
await app.register(oauthYouTubeRoutes);

const port = Number(process.env.PORT ?? 4000);

try {
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`API listening on http://localhost:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
