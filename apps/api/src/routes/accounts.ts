import type { FastifyInstance } from "fastify";
import { patchAccountBodySchema } from "@richfeed/shared";
import { requireUser, sendUnauthorized } from "../lib/auth";
import { deleteSocialAccountPermanently, disconnectSocialAccount, listSocialAccounts } from "../db/queries";

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

  // PATCH /api/accounts/:id — currently only supports { action: "disconnect" },
  // a soft status change (status='disconnected'). post_targets/publish_attempts
  // are left alone so publish history survives.
  app.patch<{ Params: { id: string } }>("/api/accounts/:id", async (request, reply) => {
    try {
      const user = await requireUser(request);
      const parsed = patchAccountBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Invalid request body", details: parsed.error.flatten() });
      }

      const disconnected = await disconnectSocialAccount(user.id, request.params.id);
      if (!disconnected) {
        return reply.code(404).send({ error: "Account not found" });
      }
      return { ok: true };
    } catch (err) {
      sendUnauthorized(reply, err);
    }
  });

  // DELETE /api/accounts/:id — permanent removal. Blocked (409) while any
  // post_targets still reference the account, since that FK isn't cascading.
  app.delete<{ Params: { id: string } }>("/api/accounts/:id", async (request, reply) => {
    try {
      const user = await requireUser(request);
      const result = await deleteSocialAccountPermanently(user.id, request.params.id);
      if (!result.ok) {
        if (result.reason === "not_found") {
          return reply.code(404).send({ error: "Account not found" });
        }
        return reply.code(409).send({
          error: "This account still has scheduled or published posts attached. Cancel or reassign them first.",
        });
      }
      return { ok: true };
    } catch (err) {
      sendUnauthorized(reply, err);
    }
  });
}
