import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  whatsappMessages: defineTable({
    messageId: v.string(), // Twilio message SID
    from: v.string(), // Phone number with whatsapp: prefix
    to: v.string(), // Phone number with whatsapp: prefix
    body: v.string(), // Message content
    status: v.string(), // Message status (sent, delivered, read, failed, etc.)
    direction: v.union(v.literal("inbound"), v.literal("outbound")), // Message direction
    mediaUrl: v.optional(v.string()), // URL for media attachments
    mediaContentType: v.optional(v.string()), // Content type of media
    twilioData: v.optional(v.any()), // Raw Twilio webhook data
  })
    .index("by_from", ["from"])
    .index("by_to", ["to"])
    .index("by_message_id", ["messageId"])
    .index("by_direction", ["direction"]),

  whatsappContacts: defineTable({
    phoneNumber: v.string(), // Phone number with whatsapp: prefix
    name: v.optional(v.string()), // Contact name
    lastMessageTime: v.optional(v.number()), // Last message timestamp
    isActive: v.boolean(), // Whether contact is active
  })
    .index("by_phone", ["phoneNumber"])
    .index("by_active", ["isActive"]),

  aiInteractions: defineTable({
    originalMessageId: v.string(), // Reference to the original WhatsApp message
    userMessage: v.string(), // The user's message that triggered AI
    aiResponse: v.string(), // The AI's response
    phoneNumber: v.string(), // Phone number of the user
    timestamp: v.number(), // When the interaction occurred
  })
    .index("by_phone", ["phoneNumber"])
    .index("by_message_id", ["originalMessageId"])
    .index("by_timestamp", ["timestamp"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
