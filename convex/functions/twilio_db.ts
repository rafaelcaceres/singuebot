import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";

/**
 * Get or create a participant by phone number
 */
export const getOrCreateParticipant = internalMutation({
  args: {
    phone: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if participant already exists
    const existing = await ctx.db
      .query("participants")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .first();

    if (existing) {
      return existing;
    }

    // Create new participant
    const participantId = await ctx.db.insert("participants", {
      phone: args.phone,
      consent: false,
      tags: [],
      createdAt: Date.now(),
    });

    return await ctx.db.get(participantId);
  },
});

/**
 * Update participant consent status
 */
export const updateParticipantConsent = internalMutation({
  args: {
    participantId: v.id("participants"),
    consent: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.participantId, { consent: args.consent });
  },
});

/**
 * Get template for a specific stage and locale
 */
export const getTemplateForStage = internalQuery({
  args: {
    stage: v.string(),
    locale: v.string(),
  },
  handler: async (ctx, args) => {
    // This would query your templates table - implement based on your schema
    return null; // Placeholder
  },
});

/**
 * Log analytics event
 */
export const logAnalyticsEvent = internalMutation({
  args: {
    type: v.string(),
    refId: v.string(),
    meta: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("analytics_events", {
      type: args.type,
      refId: args.refId,
      meta: args.meta,
      createdAt: Date.now(),
    });
  },
});

/**
 * Get participant by ID
 */
export const getParticipant = internalQuery({
  args: {
    participantId: v.id("participants"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.participantId);
  },
});

/**
 * Get template by name
 */
export const getTemplateByName = internalQuery({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    // This would query your templates table - implement based on your schema
    return null; // Placeholder
  },
});