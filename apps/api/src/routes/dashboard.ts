import type { FastifyInstance } from "fastify";
import { requireUser, sendUnauthorized } from "../lib/auth";
import { getAttentionItems, getDashboardStats, getUpcomingPreview } from "../db/queries";

/**
 * GET /api/dashboard — aggregated data for the Dashboard page (stat tiles,
 * attention list, upcoming preview). Not in the spec's literal route list,
 * but required to satisfy "no hardcoded numbers" on that page without the
 * frontend re-deriving aggregate counts from full list payloads.
 */
export async function dashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/dashboard", async (request, reply) => {
    try {
      const user = await requireUser(request);
      const [stats, attention, upcoming] = await Promise.all([
        getDashboardStats(user.id),
        getAttentionItems(user.id),
        getUpcomingPreview(user.id, 5),
      ]);
      return { stats, attention, upcoming };
    } catch (err) {
      sendUnauthorized(reply, err);
    }
  });
}
