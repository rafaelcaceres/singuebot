import { v } from "convex/values";
import { internalMutation, mutation, query, action } from "./_generated/server";
import { internal, api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

// Helper function to create or get participant
export const createOrGetParticipant = internalMutation({
  args: {
    phone: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if participant already exists
    const existingParticipant = await ctx.db
      .query("participants")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .unique();

    if (existingParticipant) {
      return existingParticipant._id;
    }

    // Create new participant
    const participantId = await ctx.db.insert("participants", {
      phone: args.phone,
      name: args.name,
      consent: false, // Default to false, can be updated later
      tags: [],
      createdAt: Date.now(),
    });

    return participantId;
  },
});

// Helper function to create or get conversation
export const createOrGetConversation = internalMutation({
  args: {
    participantId: v.id("participants"),
  },
  handler: async (ctx, args) => {
    // Check if there's an open conversation for this participant
    const existingConversation = await ctx.db
      .query("conversations")
      .withIndex("by_participant", (q) => q.eq("participantId", args.participantId))
      .filter((q) => q.eq(q.field("isOpen"), true))
      .unique();

    if (existingConversation) {
      // Update last message time
      await ctx.db.patch(existingConversation._id, {
        lastMessageAt: Date.now(),
      });
      return existingConversation._id;
    }

    // Create new conversation
    const conversationId = await ctx.db.insert("conversations", {
      participantId: args.participantId,
      channel: "whatsapp",
      openedAt: Date.now(),
      lastMessageAt: Date.now(),
      isOpen: true,
    });

    return conversationId;
  },
});

// Query to get messages by participant
export const getMessages = query({
  args: {
    phoneNumber: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { phoneNumber, limit = 50 } = args;

    // Find the participant by phone number
    const participant = await ctx.db
      .query("participants")
      .withIndex("by_phone", (q) => q.eq("phone", phoneNumber))
      .unique();

    if (!participant) {
      return [];
    }

    // Get messages for this participant
    const messages = await ctx.db
      .query("whatsappMessages")
      .withIndex("by_participant", (q) => q.eq("participantId", participant._id))
      .order("desc")
      .take(limit);

    return messages.reverse(); // Return in chronological order
  },
});

export const getMessagesByParticipant = query({
  args: {
    participantId: v.id("participants"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;

    const baseQuery = ctx.db
      .query("whatsappMessages")
      .withIndex("by_participant", (q) => q.eq("participantId", args.participantId))
      .order("desc");

    const query = args.cursor
      ? baseQuery.filter((q) => q.lt(q.field("_creationTime"), parseInt(args.cursor!)))
      : baseQuery;

    const messages = await query.take(limit + 1);

    const hasMore = messages.length > limit;
    const results = hasMore ? messages.slice(0, limit) : messages;
    const nextCursor = hasMore ? results[results.length - 1]._creationTime.toString() : null;

    return {
      messages: results,
      nextCursor,
      hasMore,
    };
  },
});

// Query to get conversation history
export const getConversationHistory = query({
  args: {
    conversationId: v.id("conversations"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    
    let query = ctx.db
      .query("whatsappMessages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("desc");

    if (args.cursor) {
      query = query.filter((q) => q.lt(q.field("_creationTime"), parseInt(args.cursor!)));
    }

    const messages = await query.take(limit + 1);
    
    const hasMore = messages.length > limit;
    const results = hasMore ? messages.slice(0, limit) : messages;
    const nextCursor = hasMore ? results[results.length - 1]._creationTime.toString() : null;

    return {
      messages: results,
      nextCursor,
      hasMore,
    };
  },
});

// Query to get all active contacts
export const getContacts = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("whatsappContacts")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .order("desc")
      .collect();
  },
});

// Legacy function - now uses participant-based lookup
export const getConversation = query({
  args: {
    phoneNumber1: v.string(),
    phoneNumber2: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;

    // Find participants for both phone numbers
    const participant1 = await ctx.db
      .query("participants")
      .withIndex("by_phone", (q) => q.eq("phone", args.phoneNumber1))
      .unique();

    const participant2 = await ctx.db
      .query("participants")
      .withIndex("by_phone", (q) => q.eq("phone", args.phoneNumber2))
      .unique();

    if (!participant1 && !participant2) {
      return [];
    }

    // Get messages involving either participant using immutable patterns
    const getMessagesForParticipant = async (participantId: Id<"participants">) =>
      ctx.db
        .query("whatsappMessages")
        .withIndex("by_participant", (q) => q.eq("participantId", participantId))
        .order("desc")
        .take(limit);

    const messagePromises = [
      participant1 ? getMessagesForParticipant(participant1._id) : Promise.resolve([]),
      participant2 ? getMessagesForParticipant(participant2._id) : Promise.resolve([])
    ];

    const [messages1, messages2] = await Promise.all(messagePromises);
    
    // Combine and sort by creation time using immutable operations
    const allMessages = [...messages1, ...messages2];
    const sortedMessages = allMessages
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, limit);

    return sortedMessages;
  },
});

// Mutation to store incoming message
// Updated store incoming message with participant/conversation linking
export const storeInboundMessage = mutation({
  args: {
    messageId: v.string(),
    from: v.string(),
    to: v.string(),
    body: v.string(),
    messageType: v.string(),
    mediaUrl: v.optional(v.string()),
    mediaContentType: v.optional(v.string()),
    twilioData: v.any(),
    threadId: v.optional(v.string()),
    audioTranscription: v.optional(v.object({
      originalMediaUrl: v.string(),
      transcribedText: v.string(),
      processingTimeMs: v.number(),
      success: v.boolean(),
      error: v.optional(v.string()),
      audioMetadata: v.optional(v.object({
        duration: v.optional(v.number()),
        fileSize: v.optional(v.number()),
        format: v.string(),
      })),
    })),
  },
  handler: async (ctx, args): Promise<Id<"whatsappMessages">> => {
    // Create or get participant
    const participantId: Id<"participants"> = await ctx.runMutation(internal.whatsapp.createOrGetParticipant, {
      phone: args.from,
    });

    // Create or get conversation
    const conversationId: Id<"conversations"> = await ctx.runMutation(internal.whatsapp.createOrGetConversation, {
      participantId,
    });

    // Store the message
    const messageDocId = await ctx.db.insert("whatsappMessages", {
      messageId: args.messageId,
      participantId,
      conversationId,
      body: args.body,
      direction: "inbound",
      messageType: "inbound",
      status: "received",
      mediaUrl: args.mediaUrl,
      mediaContentType: args.mediaContentType,
      audioTranscription: args.audioTranscription,
      stateSnapshot: {
        twilioPayload: {
          MessageSid: args.twilioData.MessageSid || args.messageId,
          AccountSid: args.twilioData.AccountSid || "",
          From: args.from,
          To: args.to,
          Body: args.body,
          MediaUrl0: args.mediaUrl,
          MediaContentType0: args.mediaContentType,
        },
        processingState: {
          received: Date.now(),
        },
      },
    });

    // Update or create contact (legacy support)
    const existingContact = await ctx.db
      .query("whatsappContacts")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", args.from))
      .unique();

    if (existingContact) {
      await ctx.db.patch(existingContact._id, {
        lastMessageTime: Date.now(),
        isActive: true,
      });
    } else {
      await ctx.db.insert("whatsappContacts", {
        phoneNumber: args.from,
        lastMessageTime: Date.now(),
        isActive: true,
      });
    }

    return messageDocId;
  },
});

// Mutation to update message status
export const updateMessageStatus = mutation({
  args: {
    messageId: v.string(),
    status: v.union(
      v.literal("received"),
      v.literal("processing"),
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("read"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db
      .query("whatsappMessages")
      .withIndex("by_message_id", (q) => q.eq("messageId", args.messageId))
      .unique();

    if (!message) {
      throw new Error(`Message with ID ${args.messageId} not found`);
    }

    await ctx.db.patch(message._id, {
      status: args.status,
    });

    return message._id;
  },
});

// Action to send WhatsApp message via Twilio
export const sendMessage = action({
  args: {
    to: v.string(),
    body: v.string(),
    mediaUrl: v.optional(v.string()),
  },
  handler: async (ctx: any, args: any) => {
    const { to, body, mediaUrl } = args;

    // Validate that we have either a body or media URL
    if (!body?.trim() && !mediaUrl) {
      console.error("❌ WhatsApp: Cannot send message without body or media URL", { to, body, mediaUrl });
      throw new Error("A text message body or media URL must be specified");
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      throw new Error("Twilio credentials not configured");
    }

    // Ensure both numbers have the whatsapp: prefix
    const formattedFrom = fromNumber.startsWith("whatsapp:") ? fromNumber : `whatsapp:${fromNumber}`;
    const formattedTo = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;

    // Prepare the message data
    const messageData = new URLSearchParams({
      From: formattedFrom,
      To: formattedTo,
    });

    // Only add Body if it's not empty
    if (body?.trim()) {
      messageData.append("Body", body.trim());
    }

    if (mediaUrl) {
      messageData.append('MediaUrl', mediaUrl);
    }

    // Send message via Twilio API
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: messageData.toString(),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send message: ${error}`);
    }

    const twilioResponse = await response.json();

    // Store the outbound message
    await ctx.runMutation(api.whatsapp.storeOutboundMessage, {
      messageId: twilioResponse.sid,
      from: formattedFrom,
      to: formattedTo,
      body: args.body,
      messageType: "outbound",
      mediaUrl: args.mediaUrl,
      twilioData: twilioResponse,
    });

    return twilioResponse;
  },
});

// Updated store outbound message with participant/conversation linking
export const storeOutboundMessage = mutation({
  args: {
    messageId: v.string(),
    to: v.string(),
    from: v.string(),
    body: v.string(),
    messageType: v.string(),
    mediaUrl: v.optional(v.string()),
    mediaContentType: v.optional(v.string()),
    twilioData: v.any(),
    threadId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Id<"whatsappMessages">> => {
    // Create or get participant
    const participantId: Id<"participants"> = await ctx.runMutation(internal.whatsapp.createOrGetParticipant, {
      phone: args.to,
    });

    // Create or get conversation
    const conversationId: Id<"conversations"> = await ctx.runMutation(internal.whatsapp.createOrGetConversation, {
      participantId,
    });

    // Store the message
    const messageDocId = await ctx.db.insert("whatsappMessages", {
      messageId: args.messageId,
      participantId,
      conversationId,
      body: args.body,
      direction: "outbound",
      messageType: "outbound",
      status: "sent",
      mediaUrl: args.mediaUrl,
      mediaContentType: args.mediaContentType,
      stateSnapshot: {
        twilioPayload: {
          MessageSid: args.twilioData.MessageSid || args.messageId,
          AccountSid: args.twilioData.AccountSid || "",
          From: args.from,
          To: args.to,
          Body: args.body,
          MediaUrl0: args.mediaUrl,
          MediaContentType0: args.mediaContentType,
        },
        processingState: {
          received: Date.now(),
        },
      },
    });

    // Update or create contact (legacy support)
    const existingContact = await ctx.db
      .query("whatsappContacts")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", args.to))
      .unique();

    if (existingContact) {
      await ctx.db.patch(existingContact._id, {
        lastMessageTime: Date.now(),
        isActive: true,
      });
    } else {
      await ctx.db.insert("whatsappContacts", {
        phoneNumber: args.to,
        lastMessageTime: Date.now(),
        isActive: true,
      });
    }

    return messageDocId;
  },
});
