import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

/**
 * Retrieves the active thread ID for a participant
 * Returns null if no thread exists
 */
export const getParticipantThreadId = internalQuery({
  args: {
    phone: v.string(),
  },
  handler: async (ctx, { phone }) => {
    const participant = await ctx.db
      .query("participants")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .first();

    return participant?.threadId || null;
  },
});

/**
 * Sets the active thread ID for a participant
 * Creates participant if doesn't exist
 */
export const setParticipantThreadId = internalMutation({
  args: {
    phone: v.string(),
    threadId: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, { phone, threadId, name }) => {
    const existingParticipant = await ctx.db
      .query("participants")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .first();

    if (existingParticipant) {
      // Update existing participant with new thread ID
      await ctx.db.patch(existingParticipant._id, {
        threadId,
        ...(name && { name }), // Update name if provided
      });
      return existingParticipant._id;
    } else {
      // Create new participant with thread ID
      const participantId = await ctx.db.insert("participants", {
        phone,
        name: name || undefined,
        consent: false, // Default consent to false for new participants
        clusterId: undefined,
        tags: [],
        createdAt: Date.now(),
        threadId,
      });
      return participantId;
    }
  },
});

/**
 * Clears the thread ID for a participant (useful for resetting conversations)
 */
export const clearParticipantThreadId = internalMutation({
  args: {
    phone: v.string(),
  },
  handler: async (ctx, { phone }) => {
    const participant = await ctx.db
      .query("participants")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .first();

    if (participant) {
      await ctx.db.patch(participant._id, {
        threadId: undefined,
      });
    }
  },
});

/**
 * Gets participant info including thread ID
 */
export const getParticipantInfo = internalQuery({
  args: {
    phone: v.string(),
  },
  handler: async (ctx, { phone }) => {
    const participant = await ctx.db
      .query("participants")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .first();

    return participant || null;
  },
});