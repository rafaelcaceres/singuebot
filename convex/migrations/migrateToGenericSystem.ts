import { internalMutation, internalQuery, internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";

// Migration script to convert existing WhatsApp data to generic multi-tenant system
export const migrateWhatsAppToGeneric = internalAction({
  args: {
    tenantSlug: v.string(),
    tenantName: v.string(),
    botName: v.string(),
    dryRun: v.optional(v.boolean()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    stats: v.object({
      participantsMigrated: v.number(),
      conversationsMigrated: v.number(),
      messagesMigrated: v.number(),
      errors: v.array(v.string()),
    }),
  }),
  handler: async (ctx, args) => {
    const dryRun = args.dryRun ?? false;
    const stats = {
      participantsMigrated: 0,
      conversationsMigrated: 0,
      messagesMigrated: 0,
      errors: [] as string[],
    };

    try {
      console.log(`🚀 Starting migration to generic system (dryRun: ${dryRun})`);
      console.log(`📋 Tenant: ${args.tenantName} (${args.tenantSlug}), Bot: ${args.botName}`);

      // Step 1: Create or get tenant
      let tenantId: Id<"tenants"> | null = null;
      if (!dryRun) {
        tenantId = await ctx.runMutation(internal.migrations.migrateToGenericSystem.createTenant, {
          name: args.tenantName,
          slug: args.tenantSlug,
        });
        console.log(`✅ Created/found tenant: ${tenantId}`);
      }

      // Step 2: Create or get bot
      let botId: Id<"bots"> | null = null;
      if (!dryRun && tenantId) {
        botId = await ctx.runMutation(internal.migrations.migrateToGenericSystem.createBot, {
          tenantId,
          name: args.botName,
          description: "Migrated WhatsApp bot",
        });
        console.log(`✅ Created/found bot: ${botId}`);
      }

      // Step 3: Create WhatsApp channel
      let channelId: Id<"channels"> | null = null;
      if (!dryRun && tenantId && botId) {
        channelId = await ctx.runMutation(internal.migrations.migrateToGenericSystem.createChannel, {
          tenantId,
          botId,
          type: "whatsapp",
          name: "WhatsApp Channel",
        });
        console.log(`✅ Created/found channel: ${channelId}`);
      }

      // Step 4: Migrate participants to generic contacts
      const participants = await ctx.runQuery(internal.migrations.migrateToGenericSystem.getAllParticipants, {});
      console.log(`📞 Found ${participants.length} participants to migrate`);

      for (const participant of participants) {
        try {
          if (!dryRun && tenantId && botId && channelId) {
            await ctx.runMutation(internal.migrations.migrateToGenericSystem.migrateParticipantToContact, {
              participant,
              tenantId,
              botId,
              channelId,
            });
          }
          stats.participantsMigrated++;
        } catch (error) {
          const errorMsg = `Failed to migrate participant ${participant._id}: ${String(error)}`;
          console.error(`❌ ${errorMsg}`);
          stats.errors.push(errorMsg);
        }
      }

      // Step 5: Migrate conversations
      const conversations = await ctx.runQuery(internal.migrations.migrateToGenericSystem.getAllConversations, {});
      console.log(`💬 Found ${conversations.length} conversations to migrate`);

      for (const conversation of conversations) {
        try {
          if (!dryRun && tenantId && botId && channelId) {
            await ctx.runMutation(internal.migrations.migrateToGenericSystem.migrateConversation, {
              conversation,
              tenantId,
              botId,
              channelId,
            });
          }
          stats.conversationsMigrated++;
        } catch (error) {
          const errorMsg = `Failed to migrate conversation ${conversation._id}: ${String(error)}`;
          console.error(`❌ ${errorMsg}`);
          stats.errors.push(errorMsg);
        }
      }

      // Step 6: Migrate messages
      const messages = await ctx.runQuery(internal.migrations.migrateToGenericSystem.getAllWhatsAppMessages, {});
      console.log(`📨 Found ${messages.length} messages to migrate`);

      for (const message of messages) {
        try {
          if (!dryRun && tenantId && botId && channelId) {
            await ctx.runMutation(internal.migrations.migrateToGenericSystem.migrateMessage, {
              message,
              tenantId,
              botId,
              channelId,
            });
          }
          stats.messagesMigrated++;
        } catch (error) {
          const errorMsg = `Failed to migrate message ${message._id}: ${String(error)}`;
          console.error(`❌ ${errorMsg}`);
          stats.errors.push(errorMsg);
        }
      }

      const successMessage = dryRun 
        ? `✅ Dry run completed successfully. Would migrate: ${stats.participantsMigrated} participants, ${stats.conversationsMigrated} conversations, ${stats.messagesMigrated} messages`
        : `✅ Migration completed successfully. Migrated: ${stats.participantsMigrated} participants, ${stats.conversationsMigrated} conversations, ${stats.messagesMigrated} messages`;

      console.log(successMessage);

      return {
        success: true,
        message: successMessage,
        stats,
      };

    } catch (error) {
      const errorMessage = `❌ Migration failed: ${String(error)}`;
      console.error(errorMessage);
      stats.errors.push(errorMessage);

      return {
        success: false,
        message: errorMessage,
        stats,
      };
    }
  },
});

// Helper functions for migration

export const createTenant = internalMutation({
  args: {
    name: v.string(),
    slug: v.string(),
  },
  returns: v.id("tenants"),
  handler: async (ctx, args) => {
    // Check if tenant already exists
    const existing = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (existing) {
      return existing._id;
    }

    // Create new tenant
    return await ctx.db.insert("tenants", {
      name: args.name,
      slug: args.slug,
      description: "Migrated tenant",
      settings: {
        timezone: "America/Sao_Paulo",
        locale: "pt-BR",
        branding: {
          primaryColor: "#007bff",
          companyName: args.name,
        },
      },
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const createBot = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    name: v.string(),
    description: v.string(),
  },
  returns: v.id("bots"),
  handler: async (ctx, args) => {
    // Check if bot already exists
    const existing = await ctx.db
      .query("bots")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();

    if (existing) {
      return existing._id;
    }

    // Create new bot
    return await ctx.db.insert("bots", {
      tenantId: args.tenantId,
      name: args.name,
      type: "custom",
      description: args.description,
      config: {
        personality: "You are a helpful AI assistant.",
        maxTokens: 500,
        temperature: 0.7,
        model: "gpt-3.5-turbo",
        fallbackMessage: "Desculpe, não consegui processar sua mensagem no momento.",
        enableRAG: true,
        ragNamespace: `${args.name.toLowerCase().replace(/\s+/g, '_')}_knowledge`,
      },
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const createChannel = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    botId: v.id("bots"),
    type: v.string(),
    name: v.string(),
  },
  returns: v.id("channels"),
  handler: async (ctx, args) => {
    // Check if channel already exists
    const existing = await ctx.db
      .query("channels")
      .withIndex("by_tenant_bot", (q) => 
        q.eq("tenantId", args.tenantId).eq("botId", args.botId)
      )
      .filter((q) => q.eq(q.field("type"), args.type))
      .first();

    if (existing) {
      return existing._id;
    }

    // Create new channel
    return await ctx.db.insert("channels", {
      tenantId: args.tenantId,
      botId: args.botId,
      type: args.type as "whatsapp" | "telegram" | "web" | "api",
      name: args.name,
      config: {
        webhookUrl: "",
        apiKey: "",
      },
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const getAllParticipants = internalQuery({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db.query("participants").collect();
  },
});

export const getAllConversations = internalQuery({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db.query("conversations").collect();
  },
});

export const getAllWhatsAppMessages = internalQuery({
  args: {},
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    return await ctx.db.query("whatsappMessages").collect();
  },
});

export const migrateParticipantToContact = internalMutation({
  args: {
    participant: v.any(),
    tenantId: v.id("tenants"),
    botId: v.id("bots"),
    channelId: v.id("channels"),
  },
  returns: v.id("genericContacts"),
  handler: async (ctx, args) => {
    const { participant, tenantId, botId, channelId } = args;

    return await ctx.db.insert("genericContacts", {
      tenantId,
      channelId,
      externalId: participant.phone,
      name: participant.name || "Unknown",
      metadata: {
        phone: participant.phone,
        migratedFrom: "participants",
        originalId: String(participant._id),
      },
      lastMessageTime: participant._creationTime,
      isActive: true,
      createdAt: Date.now(),
    });
  },
});

export const migrateConversation = internalMutation({
  args: {
    conversation: v.any(),
    tenantId: v.id("tenants"),
    botId: v.id("bots"),
    channelId: v.id("channels"),
  },
  returns: v.id("genericConversations"),
  handler: async (ctx, args) => {
    const { conversation, tenantId, botId, channelId } = args;

    // Find the migrated contact
    const contact = await ctx.db
      .query("genericContacts")
      .withIndex("by_channel_external", (q) =>
        q.eq("channelId", channelId)
         .eq("externalId", conversation.participantId)
      )
      .first();

    if (!contact) {
      throw new Error(`Contact not found for participant: ${conversation.participantId}`);
    }

    return await ctx.db.insert("genericConversations", {
      tenantId,
      botId,
      channelId,
      contactId: contact._id,
      participantId: conversation.participantId,
      state: "active",
      context: {
        migratedFrom: "conversations",
        originalId: conversation._id,
      },
      openedAt: conversation.openedAt || conversation._creationTime,
      lastMessageAt: conversation.lastMessageAt || conversation._creationTime,
      closedAt: conversation.isOpen ? undefined : Date.now(),
    });
  },
});

export const migrateMessage = internalMutation({
  args: {
    message: v.any(),
    tenantId: v.id("tenants"),
    botId: v.id("bots"),
    channelId: v.id("channels"),
  },
  returns: v.id("genericMessages"),
  handler: async (ctx, args) => {
    const { message, tenantId, botId, channelId } = args;

    // Find the migrated conversation
    const conversation = await ctx.db
      .query("genericConversations")
      .filter((q) => 
        q.and(
          q.eq(q.field("tenantId"), tenantId),
          q.eq(q.field("botId"), botId),
          q.eq(q.field("channelId"), channelId),
          q.eq(q.field("context.originalId"), message.conversationId)
        )
      )
      .first();

    if (!conversation) {
      throw new Error(`Conversation not found for message: ${message._id}`);
    }

    return await ctx.db.insert("genericMessages", {
      tenantId,
      conversationId: conversation._id,
      externalId: message.messageId || message._id,
      direction: message.direction || "inbound",
      status: message.status || "delivered",
      content: {
        text: message.body || message.content?.text,
        mediaUrl: message.mediaUrl,
        mediaType: message.mediaContentType,
        metadata: {
          migratedFrom: "whatsappMessages",
          originalId: message._id,
        },
      },
      aiMetadata: message.aiMetadata,
      rawData: {
        migratedFrom: "whatsappMessages",
        originalId: message._id,
        originalData: message,
      },
      createdAt: message._creationTime || Date.now(),
      updatedAt: Date.now(),
    });
  },
});