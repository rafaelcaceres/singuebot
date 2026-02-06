import { v } from "convex/values";
import { internalQuery, query, mutation } from "../_generated/server";

// Get channel by tenant slug, bot name, and channel type
export const getChannelByPath = internalQuery({
  args: {
    tenantSlug: v.string(),
    botName: v.string(),
    channelType: v.union(v.literal("whatsapp"), v.literal("telegram"), v.literal("web"), v.literal("api"))
  },
  returns: v.union(
    v.object({
      _id: v.id("channels"),
      _creationTime: v.number(),
      tenantId: v.id("tenants"),
      botId: v.id("bots"),
      type: v.union(v.literal("whatsapp"), v.literal("telegram"), v.literal("web"), v.literal("api")),
      name: v.string(),
      config: v.any(),
      isActive: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number()
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    // First, get tenant by slug
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", args.tenantSlug))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    if (!tenant) {
      return null;
    }

    // Then, get bot by name within the tenant - need to scan since no index exists
    const bots = await ctx.db
      .query("bots")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
      .filter((q) => q.eq(q.field("name"), args.botName))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();

    const bot = bots[0];
    if (!bot) {
      return null;
    }

    // Finally, get channel by type within the bot
    const channel = await ctx.db
      .query("channels")
      .withIndex("by_tenant_bot", (q) =>
        q.eq("tenantId", tenant._id).eq("botId", bot._id)
      )
      .filter((q) => q.eq(q.field("type"), args.channelType))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    return channel;
  },
});

// Get all channels for a tenant
export const getChannelsByTenant = query({
  args: { tenantId: v.id("tenants") },
  returns: v.array(v.object({
    _id: v.id("channels"),
    _creationTime: v.number(),
    tenantId: v.id("tenants"),
    botId: v.id("bots"),
    type: v.union(v.literal("whatsapp"), v.literal("telegram"), v.literal("web"), v.literal("api")),
    name: v.string(),
    config: v.any(),
    isActive: v.boolean(),
    botName: v.string(),
    tenantName: v.string()
  })),
  handler: async (ctx, args) => {
    const channels = await ctx.db
      .query("channels")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .collect();

    // Enrich with bot and tenant names
    const enrichedChannels = await Promise.all(
      channels.map(async (channel) => {
        const bot = await ctx.db.get(channel.botId);
        const tenant = await ctx.db.get(channel.tenantId);

        return {
          ...channel,
          botName: bot?.name || "Unknown",
          tenantName: tenant?.name || "Unknown"
        };
      })
    );

    return enrichedChannels;
  },
});

// Create a new channel
export const createChannel = mutation({
  args: {
    tenantId: v.id("tenants"),
    botId: v.id("bots"),
    type: v.union(v.literal("whatsapp"), v.literal("telegram"), v.literal("web"), v.literal("api")),
    name: v.string(),
    config: v.any()
  },
  returns: v.id("channels"),
  handler: async (ctx, args) => {
    // Verify tenant and bot exist and are active
    const tenant = await ctx.db.get(args.tenantId);
    const bot = await ctx.db.get(args.botId);

    if (!tenant || !tenant.isActive) {
      throw new Error("Tenant not found or inactive");
    }

    if (!bot || !bot.isActive || bot.tenantId !== args.tenantId) {
      throw new Error("Bot not found, inactive, or doesn't belong to tenant");
    }

    // Check if channel already exists for this tenant/bot/type combination
    const existingChannel = await ctx.db
      .query("channels")
      .withIndex("by_tenant_bot", (q) =>
        q.eq("tenantId", args.tenantId).eq("botId", args.botId)
      )
      .filter((q) => q.eq(q.field("type"), args.type))
      .first();

    if (existingChannel) {
      throw new Error(`Channel of type ${args.type} already exists for this bot`);
    }

    // Create the channel
    const channelId = await ctx.db.insert("channels", {
      tenantId: args.tenantId,
      botId: args.botId,
      type: args.type,
      name: args.name,
      config: args.config,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    return channelId;
  },
});

// Update channel configuration
export const updateChannelConfiguration = mutation({
  args: {
    channelId: v.id("channels"),
    config: v.any()
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const channel = await ctx.db.get(args.channelId);

    if (!channel) {
      throw new Error("Channel not found");
    }

    await ctx.db.patch(args.channelId, {
      config: args.config,
      updatedAt: Date.now()
    });

    return null;
  },
});

// Toggle channel active status
export const toggleChannelStatus = mutation({
  args: {
    channelId: v.id("channels"),
    isActive: v.boolean()
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const channel = await ctx.db.get(args.channelId);

    if (!channel) {
      throw new Error("Channel not found");
    }

    await ctx.db.patch(args.channelId, {
      isActive: args.isActive
    });

    return null;
  },
});

// Get channel by ID with enriched data
export const getChannelById = query({
  args: { channelId: v.id("channels") },
  returns: v.union(
    v.object({
      _id: v.id("channels"),
      _creationTime: v.number(),
      tenantId: v.id("tenants"),
      botId: v.id("bots"),
      type: v.union(v.literal("whatsapp"), v.literal("telegram"), v.literal("web"), v.literal("api")),
      name: v.string(),
      config: v.any(),
      isActive: v.boolean(),
      botName: v.string(),
      tenantName: v.string(),
      tenantSlug: v.string()
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const channel = await ctx.db.get(args.channelId);

    if (!channel) {
      return null;
    }

    const bot = await ctx.db.get(channel.botId);
    const tenant = await ctx.db.get(channel.tenantId);

    return {
      ...channel,
      botName: bot?.name || "Unknown",
      tenantName: tenant?.name || "Unknown",
      tenantSlug: tenant?.slug || "unknown"
    };
  },
});