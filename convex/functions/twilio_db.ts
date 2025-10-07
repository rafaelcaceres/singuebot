import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { normalizePhoneNumber } from "../utils/phoneNormalizer";

/**
 * Get or create a participant by phone number
 */
export const getOrCreateParticipant = internalMutation({
  args: {
    phone: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("participants"),
      _creationTime: v.number(),
      phone: v.string(),
      name: v.optional(v.string()),
      consent: v.boolean(),
      clusterId: v.optional(v.id("clusters")),
      tags: v.array(v.string()),
      createdAt: v.number(),
      threadId: v.optional(v.string()),
      cargo: v.optional(v.string()),
      empresa: v.optional(v.string()),
      setor: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args): Promise<Doc<"participants"> | null> => {
    // Normalize the phone number
    const normalizedPhone = normalizePhoneNumber(args.phone);
    console.log(`🔍 getOrCreateParticipant: ${args.phone} -> ${normalizedPhone}`);
    
    // First try to find by normalized phone directly
    const existingByNormalized = await ctx.db
      .query("participants")
      .withIndex("by_phone", (q) => q.eq("phone", normalizedPhone))
      .first();

    if (existingByNormalized) {
      console.log(`✅ Found participant by normalized phone: ${existingByNormalized._id}`);
      return existingByNormalized;
    }

    // If not found, search for variations (handles legacy data)
    const existingByVariation: Doc<"participants"> | null = await ctx.runQuery(internal.utils.participantSearch.findParticipantByPhone, {
      phone: args.phone
    });
    
    if (existingByVariation) {
      console.log(`✅ Found participant by variation, updating phone: ${existingByVariation._id}`);
      // Update the participant's phone to the normalized version
      await ctx.db.patch(existingByVariation._id, { 
        phone: normalizedPhone 
      });
      
      // Return the updated participant
      return await ctx.db.get(existingByVariation._id);
    }

    // Create new participant with normalized phone
    console.log(`➕ Creating new participant with normalized phone: ${normalizedPhone}`);
    const participantId = await ctx.db.insert("participants", {
      phone: normalizedPhone,
      consent: false,
      tags: [],
      createdAt: Date.now(),
    });

    return await ctx.db.get(participantId);
  },
});

/**
 * Update participant thread ID
 */
export const updateParticipantThreadId = internalMutation({
  args: {
    participantId: v.id("participants"),
    threadId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.participantId, { threadId: args.threadId });
  },
});

/**
 * Update participant with new data
 */
export const updateParticipant = internalMutation({
  args: {
    participantId: v.id("participants"),
    updates: v.object({
      threadId: v.optional(v.string()),
      consent: v.optional(v.boolean()),
      name: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
      cargo: v.optional(v.string()),
      empresa: v.optional(v.string()),
      setor: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.participantId, args.updates);
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
    const template = await ctx.db
      .query("templates")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();
    
    return template;
  },
});

/**
 * List all available templates
 */
export const listTemplates = internalQuery({
  args: {},
  handler: async (ctx) => {
    const templates = await ctx.db
      .query("templates")
      .collect();
    
    return templates;
  },
});

/**
 * Create a new template
 */
export const createTemplate = internalMutation({
  args: {
    name: v.string(),
    locale: v.string(),
    twilioId: v.string(),
    variables: v.array(v.string()),
    stage: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if template with same name already exists
    const existing = await ctx.db
      .query("templates")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .first();

    if (existing) {
      throw new Error(`Template with name "${args.name}" already exists`);
    }

    const templateId = await ctx.db.insert("templates", {
      name: args.name,
      locale: args.locale,
      twilioId: args.twilioId,
      variables: args.variables,
      stage: args.stage,
    });

    return await ctx.db.get(templateId);
  },
});

/**
 * Update an existing template
 */
export const updateTemplate = internalMutation({
  args: {
    templateId: v.id("templates"),
    updates: v.object({
      name: v.optional(v.string()),
      locale: v.optional(v.string()),
      twilioId: v.optional(v.string()),
      variables: v.optional(v.array(v.string())),
      stage: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.templateId, args.updates);
    return await ctx.db.get(args.templateId);
  },
});

/**
 * Delete a template
 */
export const deleteTemplate = internalMutation({
  args: {
    templateId: v.id("templates"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.templateId);
  },
});
