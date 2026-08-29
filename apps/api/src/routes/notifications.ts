import type { FastifyInstance } from "fastify";
import { patchNotificationPreferencesBodySchema } from "@richfeed/shared";
import { requireUser, sendUnauthorized } from "../lib/auth";
import { getNotificationPreferences, upsertNotificationPreferences } from "../db/queries";

/**
 * GET/PATCH /api/notification-preferences — per-user toggles for what the
 * in-app NotificationBell surfaces. Persistence only: there is no email/push
 * delivery wired, so these don't send anything, they only filter the bell.
 */
export async function notificationsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/notification-preferences", async (request, reply) => {
    try {
      const user = await requireUser(request);
      const preferences = await getNotificationPreferences(user.id);
      return { preferences };
    } catch (err) {
      sendUnauthorized(reply, err);
    }
  });

  app.patch("/api/notification-preferences", async (request, reply) => {
    try {
      const user = await requireUser(request);
      const parsed = patchNotificationPreferencesBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Invalid request body", details: parsed.error.flatten() });
      }

      const preferences = await upsertNotificationPreferences(user.id, parsed.data);
      return { preferences };
    } catch (err) {
      sendUnauthorized(reply, err);
    }
  });
}
