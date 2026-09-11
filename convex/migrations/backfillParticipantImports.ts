import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { addToImportList } from "../lib/participantImports";

const BATCH_SIZE = 200;

/**
 * Seed participantImports from the legacy single-valued participants.importSource.
 *
 * Only recovers each participant's first list: memberships of people who already
 * existed when a later CSV was imported were never recorded. Re-importing those
 * CSVs fills them in (the import is idempotent for existing participants).
 *
 * Run once per deployment: `npx convex run migrations/backfillParticipantImports:backfill`
 */
export const backfill = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const page = await ctx.db
      .query("participants")
      .paginate({ numItems: BATCH_SIZE, cursor: args.cursor ?? null });

    for (const participant of page.page) {
      await addToImportList(ctx, participant._id, participant.importSource);
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.migrations.backfillParticipantImports.backfill, {
        cursor: page.continueCursor,
      });
    }
    return null;
  },
});
