import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { api } from "./_generated/api";

// Query to get all messages for a specific phone number
export const getMessages = query({
  args: {
    phoneNumber: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    
    const messages = await ctx.db
      .query("whatsappMessages")
      .withIndex("by_from", (q) => q.eq("from", args.phoneNumber))
      .order("desc")
      .take(limit);

    const messagesToContact = await ctx.db
      .query("whatsappMessages")
      .withIndex("by_to", (q) => q.eq("to", args.phoneNumber))
      .order("desc")
      .take(limit);

    // Combine and sort all messages
    const allMessages = [...messages, ...messagesToContact]
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, limit);

    return allMessages;
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

// Query to get conversation between two numbers
export const getConversation = query({
  args: {
    phoneNumber1: v.string(),
    phoneNumber2: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    
    // Get messages from phone1 to phone2
    const messages1to2 = await ctx.db
      .query("whatsappMessages")
      .filter((q) => 
        q.and(
          q.eq(q.field("from"), args.phoneNumber1),
          q.eq(q.field("to"), args.phoneNumber2)
        )
      )
      .order("desc")
      .take(limit);

    // Get messages from phone2 to phone1
    const messages2to1 = await ctx.db
      .query("whatsappMessages")
      .filter((q) => 
        q.and(
          q.eq(q.field("from"), args.phoneNumber2),
          q.eq(q.field("to"), args.phoneNumber1)
        )
      )
      .order("desc")
      .take(limit);

    // Combine and sort all messages
    const allMessages = [...messages1to2, ...messages2to1]
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, limit);

    return allMessages;
  },
});

// Mutation to store incoming message
export const storeIncomingMessage = mutation({
  args: {
    messageId: v.string(),
    from: v.string(),
    to: v.string(),
    body: v.string(),
    mediaUrl: v.optional(v.string()),
    mediaContentType: v.optional(v.string()),
    twilioData: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    // Store the message
    const messageDoc = await ctx.db.insert("whatsappMessages", {
      messageId: args.messageId,
      from: args.from,
      to: args.to,
      body: args.body,
      status: "received",
      direction: "inbound",
      mediaUrl: args.mediaUrl,
      mediaContentType: args.mediaContentType,
      twilioData: args.twilioData,
    });

    // Update or create contact
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

    return messageDoc;
  },
});

// Mutation to update message status
export const updateMessageStatus = mutation({
  args: {
    messageId: v.string(),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const message = await ctx.db
      .query("whatsappMessages")
      .withIndex("by_message_id", (q) => q.eq("messageId", args.messageId))
      .unique();

    if (message) {
      await ctx.db.patch(message._id, {
        status: args.status,
      });
    }

    return message;
  },
});

// Action to send WhatsApp message via Twilio
export const sendMessage = action({
  args: {
    to: v.string(),
    body: v.string(),
    mediaUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      throw new Error("Twilio credentials not configured");
    }

    // Ensure both numbers have the whatsapp: prefix
    const formattedFrom = fromNumber.startsWith("whatsapp:") ? fromNumber : `whatsapp:${fromNumber}`;
    const formattedTo = args.to.startsWith("whatsapp:") ? args.to : `whatsapp:${args.to}`;

    // Prepare the message data
    const messageData = new URLSearchParams({
      From: formattedFrom,
      To: formattedTo,
      Body: args.body,
    });

    if (args.mediaUrl) {
      messageData.append('MediaUrl', args.mediaUrl);
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
      status: twilioResponse.status,
      mediaUrl: args.mediaUrl,
      twilioData: twilioResponse,
    });

    return twilioResponse;
  },
});

// Mutation to store outbound message
export const storeOutboundMessage = mutation({
  args: {
    messageId: v.string(),
    from: v.string(),
    to: v.string(),
    body: v.string(),
    status: v.string(),
    mediaUrl: v.optional(v.string()),
    twilioData: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("whatsappMessages", {
      messageId: args.messageId,
      from: args.from,
      to: args.to,
      body: args.body,
      status: args.status,
      direction: "outbound",
      mediaUrl: args.mediaUrl,
      twilioData: args.twilioData,
    });
  },
});
