import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  // Enhanced WhatsApp message table with state snapshot support
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
    stateSnapshot: v.optional(v.any()), // Interview state at message time (NEVER exposed to users)
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

  // Interview & Admin tables
  participants: defineTable({
    phone: v.string(), // Phone number with whatsapp: prefix
    name: v.optional(v.string()), // Participant name
    consent: v.boolean(), // LGPD consent given
    clusterId: v.optional(v.id("clusters")), // Cluster assignment
    tags: v.array(v.string()), // Custom tags
    createdAt: v.number(), // Registration timestamp
  })
    .index("by_phone", ["phone"])
    .index("by_cluster", ["clusterId"])
    .index("by_consent", ["consent"])
    .index("by_created", ["createdAt"]),

  organizers: defineTable({
    email: v.string(), // Organizer email
    role: v.union(v.literal("owner"), v.literal("editor"), v.literal("viewer")), // Access role
  })
    .index("by_email", ["email"])
    .index("by_role", ["role"]),

  conversations: defineTable({
    participantId: v.id("participants"), // Link to participant
    channel: v.literal("whatsapp"), // Channel type
    openedAt: v.number(), // Conversation start
    lastMessageAt: v.number(), // Last message timestamp
    isOpen: v.boolean(), // Active conversation
  })
    .index("by_participant", ["participantId"])
    .index("by_last_message", ["lastMessageAt"])
    .index("by_open", ["isOpen"]),

  interview_sessions: defineTable({
    participantId: v.id("participants"), // Link to participant
    step: v.string(), // Current interview stage
    answers: v.any(), // Collected answers (JSON object)
    lastStepAt: v.number(), // Last step timestamp
  })
    .index("by_participant", ["participantId"])
    .index("by_step", ["step"])
    .index("by_last_step", ["lastStepAt"]),

  templates: defineTable({
    name: v.string(), // Template friendly name
    locale: v.string(), // Language/locale (pt-BR, en-US)
    twilioId: v.string(), // Twilio HSM template SID
    variables: v.array(v.string()), // Template variable names
    stage: v.string(), // Interview stage where used
  })
    .index("by_name", ["name"])
    .index("by_locale", ["locale"])
    .index("by_stage", ["stage"])
    .index("by_twilio_id", ["twilioId"]),

  knowledge_docs: defineTable({
    title: v.string(), // Document title
    source: v.string(), // Source file/URL
    tags: v.array(v.string()), // Document tags
    status: v.union(v.literal("ingested"), v.literal("pending"), v.literal("failed")), // Processing status
    createdAt: v.number(), // Upload timestamp
  })
    .index("by_status", ["status"])
    .index("by_created", ["createdAt"])
    .index("by_tags", ["tags"]),

  knowledge_chunks: defineTable({
    docId: v.id("knowledge_docs"), // Link to source document
    chunk: v.string(), // Text chunk content
    embedding: v.array(v.float64()), // Vector embedding
    tags: v.object({
      asa: v.optional(v.string()), // ASA category
      tema: v.optional(v.string()), // Theme/topic
      nivel: v.optional(v.string()), // Level/difficulty
    }),
  })
    .index("by_doc", ["docId"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 3072, // text-embedding-3-large dimensions
    }),

  clusters: defineTable({
    name: v.string(), // Cluster name
    description: v.string(), // Cluster description
    rules: v.optional(v.any()), // Clustering rules (JSON)
  })
    .index("by_name", ["name"]),

  content_blocks: defineTable({
    stage: v.string(), // Interview stage
    clusterId: v.optional(v.id("clusters")), // Target cluster
    prompt: v.string(), // Main prompt text
    tips: v.optional(v.array(v.string())), // Additional tips
    cta: v.optional(v.string()), // Call-to-action text
  })
    .index("by_stage", ["stage"])
    .index("by_cluster", ["clusterId"])
    .index("by_stage_cluster", ["stage", "clusterId"]),

  jobs: defineTable({
    type: v.string(), // Job type (ingestion, scheduling, etc.)
    status: v.union(
      v.literal("queued"),
      v.literal("running"),
      v.literal("done"),
      v.literal("failed")
    ),
    payload: v.any(), // Job parameters (JSON)
    progress: v.optional(v.number()), // Progress percentage (0-100)
    result: v.optional(v.any()), // Job result data
    error: v.optional(v.string()), // Error message if failed
    createdAt: v.number(), // Job creation time
    updatedAt: v.number(), // Last update time
  })
    .index("by_status", ["status"])
    .index("by_type", ["type"])
    .index("by_created", ["createdAt"])
    .index("by_updated", ["updatedAt"]),

  analytics_events: defineTable({
    type: v.string(), // Event type
    refId: v.optional(v.string()), // Reference ID (participant, message, etc.)
    meta: v.any(), // Event metadata (JSON)
    createdAt: v.number(), // Event timestamp
  })
    .index("by_type", ["type"])
    .index("by_ref", ["refId"])
    .index("by_created", ["createdAt"])
    .index("by_type_created", ["type", "createdAt"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
