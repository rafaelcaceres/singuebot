import { v } from "convex/values";
import { query, internalQuery, mutation } from "../_generated/server";
import { Id } from "../_generated/dataModel";

// Get the active bot configuration (first active bot)
export const getActiveBotConfig = internalQuery({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const bot = await ctx.db
      .query("bots")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .first();

    if (!bot) return null;

    const tenant = await ctx.db.get(bot.tenantId);
    return { ...bot, tenant };
  },
});

// Get bot by ID (for internal use)
export const getBotById = internalQuery({
  args: { botId: v.id("bots") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const bot = await ctx.db.get(args.botId);
    if (!bot) return null;

    const tenant = await ctx.db.get(bot.tenantId);
    return { ...bot, tenant };
  },
});

// Expose feature flags for the frontend
export const getFeatureFlags = query({
  args: {},
  returns: v.object({
    enableInterview: v.boolean(),
    enableClustering: v.boolean(),
    enableTemplates: v.boolean(),
    enableParticipantRAG: v.boolean(),
    enableRAG: v.boolean(),
    enableCSVImport: v.boolean(),
    consentRequired: v.boolean(),
  }),
  handler: async (ctx) => {
    const bot = await ctx.db
      .query("bots")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .first();

    return {
      enableInterview: bot?.config?.enableInterview ?? false,
      enableClustering: bot?.config?.enableClustering ?? false,
      enableTemplates: bot?.config?.enableTemplates ?? false,
      enableParticipantRAG: bot?.config?.enableParticipantRAG ?? false,
      enableRAG: bot?.config?.enableRAG ?? true,
      enableCSVImport: bot?.config?.enableCSVImport ?? false,
      consentRequired: bot?.config?.consentRequired ?? false,
    };
  },
});

// Get active bot config for the settings page
export const getActiveBotSettings = query({
  args: {},
  returns: v.any(),
  handler: async (ctx) => {
    const bot = await ctx.db
      .query("bots")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .first();

    if (!bot) return null;

    const tenant = await ctx.db.get(bot.tenantId);
    return {
      _id: bot._id,
      name: bot.name,
      type: bot.type,
      description: bot.description,
      config: bot.config,
      tenantName: tenant?.name,
      tenantSlug: tenant?.slug,
    };
  },
});

// Update bot configuration (from settings page)
export const updateBotConfig = mutation({
  args: {
    botId: v.id("bots"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    config: v.object({
      personality: v.optional(v.string()),
      maxTokens: v.optional(v.number()),
      temperature: v.optional(v.number()),
      model: v.optional(v.string()),
      fallbackMessage: v.optional(v.string()),
      enableRAG: v.boolean(),
      ragNamespace: v.optional(v.string()),
      guardrailsPrompt: v.optional(v.string()),
      enableInterview: v.optional(v.boolean()),
      enableClustering: v.optional(v.boolean()),
      enableTemplates: v.optional(v.boolean()),
      enableParticipantRAG: v.optional(v.boolean()),
      enableCSVImport: v.optional(v.boolean()),
      consentRequired: v.optional(v.boolean()),
      consentMessage: v.optional(v.string()),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { botId, ...updates } = args;
    await ctx.db.patch(botId, {
      ...updates,
      updatedAt: Date.now(),
    });
    return null;
  },
});
