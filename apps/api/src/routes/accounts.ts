import type { FastifyInstance } from "fastify";
import { patchAccountBodySchema } from "@richfeed/shared";
import { requireUser, sendUnauthorized } from "../lib/auth";
import { deleteSocialAccount, listSocialAccounts } from "../db/queries";

export async function accountsRoutes(app: FastifyInstance): Promise<void> {
  // GET /api/accounts — list the authenticated user's social_accounts.
  app.get("/api/accounts", async (request, reply) => {
    try {
      const user = await requireUser(request);
      const accounts = await listSocialAccounts(user.id);
      return { accounts };
    } catch (err) {
      sendUnauthorized(reply, err);
    }
  });

  // PATCH /api/accounts/:id — currently only supports { action: "disconnect" }.
  app.patch<{ Params: { id: string } }>("/api/accounts/:id", async (request, reply) => {
    try {
      const user = await requireUser(request);
      const parsed = patchAccountBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Invalid request body", details: parsed.error.flatten() });
      }

      const deleted = await deleteSocialAccount(user.id, request.params.id);
      if (!deleted) {
        return reply.code(404).send({ error: "Account not found" });
      }
      return { ok: true };
    } catch (err) {
      sendUnauthorized(reply, err);
    }
  });
}
