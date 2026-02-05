import { v } from "convex/values";
import { internalMutation, internalQuery, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { Id, Doc } from "../_generated/dataModel";
import { InboundMessage, OutboundMessage, SendResult } from "../types/channels";
import { getChannelAdapter } from "../adapters/registry";

// Process inbound message from any channel
export const processInboundMessage = internalAction({
  args: {
    channelId: v.id("channels"),
    tenantId: v.id("tenants"),
    botId: v.id("bots"),
    message: v.object({
      externalId: v.string(),
      from: v.string(),
      content: v.object({
        text: v.optional(v.string()),
        mediaUrl: v.optional(v.string()),
        mediaType: v.optional(v.string()),
        fileName: v.optional(v.string()),
      }),
      timestamp: v.number(),
      metadata: v.optional(v.any()),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      console.log(`🔄 Processing inbound message: ${args.message.externalId}`);

      // Find or create contact
      const contact = await ctx.runMutation(internal.functions.messages.findOrCreateContact, {
        channelId: args.channelId,
        tenantId: args.tenantId,
        externalId: args.message.from,
      });

      // Find or create conversation
      const conversation = await ctx.runMutation(internal.functions.messages.findOrCreateConversation, {
        tenantId: args.tenantId,
        botId: args.botId,
        channelId: args.channelId,
        contactId: contact,
      });

      // Store inbound message
      const messageId = await ctx.runMutation(internal.functions.messages.storeInboundMessage, {
        tenantId: args.tenantId,
        conversationId: conversation,
        message: args.message,
      });

      // Get bot configuration for AI processing
      const bot = await ctx.runQuery(internal.functions.messages.getBotConfiguration, {
        botId: args.botId,
      });

      if (bot && args.message.content.text) {
        // Process with AI asynchronously
        await ctx.runAction(internal.functions.ai.processMessageWithGenericAI, {
          messageId: messageId,
          conversationId: conversation,
          botId: args.botId,
          tenantId: args.tenantId,
          userMessage: args.message.content.text,
        });
      }

    } catch (error) {
      console.error("❌ Error processing inbound message:", error);
      throw error;
    }
  },
});

// Find or create contact
export const findOrCreateContact = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    channelId: v.id("channels"),
    externalId: v.string(),
    name: v.optional(v.string()),
  },
  returns: v.id("genericContacts"),
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Try to find existing contact
    const existingContact = await ctx.db
      .query("genericContacts")
      .withIndex("by_channel_external", (q) => 
        q.eq("channelId", args.channelId).eq("externalId", args.externalId)
      )
      .first();

    if (existingContact) {
      // Update last message time
      await ctx.db.patch(existingContact._id, {
        lastMessageTime: now,
      });
      return existingContact._id;
    }

    // Create new contact
    const contactId = await ctx.db.insert("genericContacts", {
      tenantId: args.tenantId,
      channelId: args.channelId,
      externalId: args.externalId,
      name: args.name,
      metadata: {},
      lastMessageTime: now,
      isActive: true,
      createdAt: now,
    });

    return contactId;
  },
});

export const findOrCreateConversation = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    botId: v.id("bots"),
    channelId: v.id("channels"),
    contactId: v.id("genericContacts"),
    participantId: v.optional(v.id("participants")),
  },
  returns: v.id("genericConversations"),
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Try to find existing active conversation
    const existingConversation = await ctx.db
      .query("genericConversations")
      .withIndex("by_contact", (q) => q.eq("contactId", args.contactId))
      .filter((q) => q.eq(q.field("state"), "active"))
      .first();

    if (existingConversation) {
      // Update last message time
      await ctx.db.patch(existingConversation._id, {
        lastMessageAt: now,
      });
      return existingConversation._id;
    }

    // Create new conversation
    const conversationId = await ctx.db.insert("genericConversations", {
      tenantId: args.tenantId,
      botId: args.botId,
      channelId: args.channelId,
      contactId: args.contactId,
      participantId: args.participantId,
      threadId: undefined,
      state: "active",
      context: {},
      openedAt: now,
      lastMessageAt: now,
      closedAt: undefined,
    });

    return conversationId;
  },
});

// Store inbound message
export const storeInboundMessage = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    conversationId: v.id("genericConversations"),
    message: v.object({
      externalId: v.string(),
      from: v.string(),
      content: v.object({
        text: v.optional(v.string()),
        mediaUrl: v.optional(v.string()),
        mediaType: v.optional(v.string()),
        fileName: v.optional(v.string()),
      }),
      timestamp: v.number(),
      metadata: v.optional(v.any()),
    }),
  },
  returns: v.id("genericMessages"),
  handler: async (ctx, args) => {
    const messageId = await ctx.db.insert("genericMessages", {
      tenantId: args.tenantId,
      conversationId: args.conversationId,
      externalId: args.message.externalId,
      direction: "inbound",
      content: args.message.content,
      status: "received",
      aiMetadata: undefined,
      rawData: args.message.metadata,
      createdAt: args.message.timestamp,
      updatedAt: Date.now(),
    });

    return messageId;
  },
});

// Get bot configuration
export const getBotConfiguration = internalQuery({
  args: {
    botId: v.id("bots"),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("bots"),
      tenantId: v.id("tenants"),
      name: v.string(),
      type: v.union(v.literal("interview"), v.literal("billing"), v.literal("support"), v.literal("custom")),
      description: v.optional(v.string()),
      config: v.object({
        personality: v.optional(v.string()),
        maxTokens: v.optional(v.number()),
        temperature: v.optional(v.number()),
        model: v.optional(v.string()),
        fallbackMessage: v.optional(v.string()),
        enableRAG: v.boolean(),
        ragNamespace: v.optional(v.string()),
      }),
      isActive: v.boolean(),
    })
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.botId);
  },
});

// Process message with AI
export const processMessageWithAI = internalAction({
  args: {
    messageId: v.id("genericMessages"),
    conversationId: v.id("genericConversations"),
    botConfig: v.any(),
    userMessage: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      console.log(`🤖 Processing message with AI: ${args.messageId}`);

      // Get conversation history for context
      const messages = await ctx.runQuery(internal.functions.messages.getConversationMessages, {
        conversationId: args.conversationId,
        limit: 10,
      });

      // TODO: Implement AI processing logic here
      // This would integrate with OpenAI or other AI services
      // For now, we'll just log and update the message metadata

      await ctx.runMutation(internal.functions.messages.updateMessageAIMetadata, {
        messageId: args.messageId,
        aiMetadata: {
          processed: true,
          processedAt: Date.now(),
          model: args.botConfig.configuration?.model || "gpt-3.5-turbo",
        },
      });

      console.log(`✅ AI processing completed for message: ${args.messageId}`);

    } catch (error) {
      console.error("❌ Error processing message with AI:", error);
      
      await ctx.runMutation(internal.functions.messages.updateMessageAIMetadata, {
        messageId: args.messageId,
        aiMetadata: {
          processed: false,
          error: String(error),
          processedAt: Date.now(),
        },
      });
    }
  },
});

// Send generic message
export const sendGenericMessage = internalAction({
  args: {
    channelId: v.id("channels"),
    contactExternalId: v.string(),
    content: v.object({
      text: v.optional(v.string()),
      mediaUrl: v.optional(v.string()),
      mediaType: v.optional(v.string()),
      fileName: v.optional(v.string()),
    }),
    conversationId: v.optional(v.id("genericConversations")),
  },
  returns: v.object({
    success: v.boolean(),
    messageId: v.optional(v.id("genericMessages")),
    externalId: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args): Promise<{
    success: boolean;
    messageId?: Id<"genericMessages">;
    externalId?: string;
    error?: string;
  }> => {
    try {
      // Get channel configuration
      const channel = await ctx.runQuery(internal.functions.messages.getChannelById, {
        channelId: args.channelId,
      });

      if (!channel) {
        return { success: false, error: "Channel not found" };
      }

      // Get channel adapter
      const adapter = getChannelAdapter(channel);

      // Prepare outbound message
      const outboundMessage: OutboundMessage = {
        contactExternalId: args.contactExternalId,
        content: args.content,
        metadata: {
          conversationId: args.conversationId!,
          botId: channel.botId,
          tenantId: channel.tenantId,
        },
      };

      // Send via adapter (assuming sendMessage exists on adapter)
      // Note: This might need adjustment based on actual adapter interface
      const sendResult: SendResult = { success: false, externalId: undefined };

      if (sendResult.success && sendResult.externalId) {
        // Store outbound message
        const messageId = await ctx.runMutation(internal.functions.messages.storeOutboundMessage, {
          conversationId: args.conversationId!,
          content: args.content,
          direction: "outbound",
          status: "sent",
          aiMetadata: undefined,
        });

        return {
          success: true,
          messageId,
          externalId: sendResult.externalId,
        };
      } else {
        return {
          success: false,
          error: "Failed to send message via channel adapter",
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

// Store outbound message
export const storeOutboundMessage = internalMutation({
  args: {
    conversationId: v.id("genericConversations"),
    content: v.object({
      text: v.optional(v.string()),
      mediaUrl: v.optional(v.string()),
      mediaType: v.optional(v.string()),
      fileName: v.optional(v.string()),
    }),
    direction: v.union(v.literal("inbound"), v.literal("outbound")),
    status: v.union(
      v.literal("received"),
      v.literal("processing"),
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("read"),
      v.literal("failed")
    ),
    aiMetadata: v.optional(v.any()),
  },
  returns: v.id("genericMessages"),
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // Get conversation to extract tenantId
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }
    
    const messageId = await ctx.db.insert("genericMessages", {
      tenantId: conversation.tenantId,
      conversationId: args.conversationId,
      externalId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      direction: args.direction,
      content: args.content,
      status: args.status,
      aiMetadata: args.aiMetadata,
      rawData: {},
      createdAt: now,
      updatedAt: now,
    });

    return messageId;
  },
});

// Update message status
export const updateGenericMessageStatus = internalMutation({
  args: {
    externalId: v.string(),
    status: v.union(
      v.literal("received"),
      v.literal("processing"),
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("read"),
      v.literal("failed")
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const message = await ctx.db
      .query("genericMessages")
      .withIndex("by_external_id", (q) => q.eq("externalId", args.externalId))
      .first();

    if (message) {
      await ctx.db.patch(message._id, {
        status: args.status,
        updatedAt: Date.now(),
      });
    }
  },
});

// Get conversation messages
export const getConversationMessages = internalQuery({
  args: {
    conversationId: v.id("genericConversations"),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.object({
    _id: v.id("genericMessages"),
    direction: v.union(v.literal("inbound"), v.literal("outbound")),
    content: v.object({
      text: v.optional(v.string()),
      mediaUrl: v.optional(v.string()),
      mediaType: v.optional(v.string()),
      fileName: v.optional(v.string()),
    }),
    status: v.union(
      v.literal("received"),
      v.literal("processing"),
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("read"),
      v.literal("failed")
    ),
    createdAt: v.number(),
  })),
  handler: async (ctx, args) => {
    const query = ctx.db
      .query("genericMessages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("desc");

    if (args.limit) {
      return await query.take(args.limit);
    }

    return await query.collect();
  },
});

// Update message AI metadata
export const updateMessageAIMetadata = internalMutation({
  args: {
    messageId: v.id("genericMessages"),
    aiMetadata: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      aiMetadata: args.aiMetadata,
      updatedAt: Date.now(),
    });
  },
});

// Get channel by ID
export const getChannelById = internalQuery({
  args: {
    channelId: v.id("channels"),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("channels"),
      tenantId: v.id("tenants"),
      botId: v.id("bots"),
      type: v.union(v.literal("whatsapp"), v.literal("telegram"), v.literal("web"), v.literal("api")),
      name: v.string(),
      config: v.any(),
      isActive: v.boolean(),
    })
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.channelId);
  },
});