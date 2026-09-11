import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * Record that a participant appeared in an imported CSV list.
 *
 * `participants.importSource` holds a single value (the first list a person came
 * from), so it can't answer "who is in list X?" once someone already in the base
 * shows up in a later CSV. The participantImports table is the source of truth
 * for list membership. Idempotent: re-importing the same file adds no rows.
 */
export async function addToImportList(
  ctx: MutationCtx,
  participantId: Id<"participants">,
  importSource: string | undefined,
): Promise<void> {
  const source = importSource?.trim();
  if (!source) return;

  const existing = await ctx.db
    .query("participantImports")
    .withIndex("by_participant_source", (q) =>
      q.eq("participantId", participantId).eq("importSource", source),
    )
    .first();
  if (existing) return;

  await ctx.db.insert("participantImports", {
    participantId,
    importSource: source,
    importedAt: Date.now(),
  });
}
