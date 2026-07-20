import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internalQuery, QueryCtx, MutationCtx } from "../_generated/server";

/**
 * Authorization guard for operations that spend money or reach real people.
 *
 * This is deliberately narrow. Most functions in this codebase are unguarded, and
 * fixing that wholesale is a separate job. But a publicly-callable mutation that
 * fires thousands of billed WhatsApp messages from the account's Twilio number is a
 * different risk class from a public read query, so the broadcast and template-sync
 * entry points check here.
 *
 * Note this does NOT honour the bootstrap path in admin.getOrganizerByEmail:40-46,
 * which returns `owner` for any authenticated user when the organizers table is
 * empty. That is acceptable for reads; it is not acceptable for mass send.
 */

export type OrganizerRole = "owner" | "editor" | "viewer";

const ROLE_RANK: Record<OrganizerRole, number> = {
  viewer: 0,
  editor: 1,
  owner: 2,
};

export async function requireOrganizer(
  ctx: QueryCtx | MutationCtx,
  minimumRole: OrganizerRole = "editor",
): Promise<{ email: string; role: OrganizerRole }> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new Error("Não autenticado.");
  }

  const user = await ctx.db.get(userId);
  const email = user?.email;
  if (!email) {
    throw new Error("Usuário autenticado sem e-mail — não é possível autorizar.");
  }

  const organizer = await ctx.db
    .query("organizers")
    .withIndex("by_email", (q) => q.eq("email", email))
    .first();

  if (!organizer) {
    throw new Error(
      "Sem permissão: seu e-mail não está cadastrado como organizador.",
    );
  }

  if (ROLE_RANK[organizer.role] < ROLE_RANK[minimumRole]) {
    throw new Error(
      `Sem permissão: esta ação exige o papel "${minimumRole}" ou superior.`,
    );
  }

  return { email: organizer.email, role: organizer.role };
}

/**
 * Action-callable wrapper: actions have no ctx.db, so they authorize by running
 * this query first.
 */
export const assertOrganizer = internalQuery({
  args: {
    minimumRole: v.optional(
      v.union(v.literal("owner"), v.literal("editor"), v.literal("viewer")),
    ),
  },
  returns: v.object({
    email: v.string(),
    role: v.union(v.literal("owner"), v.literal("editor"), v.literal("viewer")),
  }),
  handler: async (ctx, args) => requireOrganizer(ctx, args.minimumRole ?? "editor"),
});
