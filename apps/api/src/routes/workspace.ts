import type { FastifyInstance } from "fastify";
import { patchWorkspaceBodySchema } from "@richfeed/shared";
import { requireUser, sendUnauthorized } from "../lib/auth";
import { ensureWorkspaceForUser, updateWorkspaceName } from "../db/queries";

/** Email local-part, or a generic fallback — matches the 0002 migration's naming. */
function defaultWorkspaceName(email: string | null): string {
  const local = email?.split("@")[0]?.trim();
  return local && local.length > 0 ? local : "My Workspace";
}

/**
 * GET/PATCH /api/workspace — the authenticated user's workspace (one per user,
 * owned by them). Replaces the Step-3 stopgap that kept the workspace name on
 * Supabase Auth user_metadata.
 */
export async function workspaceRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/workspace", async (request, reply) => {
    try {
      const user = await requireUser(request);
      const workspace = await ensureWorkspaceForUser(user.id, defaultWorkspaceName(user.email));
      return { workspace };
    } catch (err) {
      sendUnauthorized(reply, err);
    }
  });

  app.patch("/api/workspace", async (request, reply) => {
    try {
      const user = await requireUser(request);
      const parsed = patchWorkspaceBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Invalid request body", details: parsed.error.flatten() });
      }

      const workspace = await updateWorkspaceName(
        user.id,
        parsed.data.name,
        defaultWorkspaceName(user.email),
      );
      return { workspace };
    } catch (err) {
      sendUnauthorized(reply, err);
    }
  });
}
