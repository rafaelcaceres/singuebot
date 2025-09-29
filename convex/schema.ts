import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  // Enhanced WhatsApp message table with normalized structure
  whatsappMessages: defineTable({
    messageId: v.string(), // Twilio message SID
    body: v.string(), // Message content
    status: v.union(
      v.literal("received"),
      v.literal("processing"),
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("read"),
      v.literal("failed")
    ), // Structured message status enum
    direction: v.union(v.literal("inbound"), v.literal("outbound")), // Message direction
    
    // AI normalization - store AI responses as outbound messages
    messageType: v.union(v.literal("inbound"), v.literal("outbound"), v.literal("ai_response")),
    aiMetadata: v.optional(v.object({
      model: v.string(),
      tokens: v.number(),
      processingTimeMs: v.number(), // Renamed for consistency with aiInteractions
      fallbackUsed: v.boolean(), // Quality metrics
      timestamp: v.number(), // AI interaction timestamp
      threadId: v.string(), // Convex Agent thread reference
      interviewState: v.optional(v.any()), // Interview state snapshot for debugging
    })),
    
    mediaUrl: v.optional(v.string()), // URL for media attachments
    mediaContentType: v.optional(v.string()), // Content type of media
    twilioData: v.optional(v.any()), // Raw Twilio webhook data
    
    // Audio transcription metadata
    audioTranscription: v.optional(v.object({
      originalMediaUrl: v.string(), // Original Twilio media URL
      transcribedText: v.string(), // Transcribed text content
      processingTimeMs: v.number(), // Time taken to transcribe
      success: v.boolean(), // Whether transcription was successful
      error: v.optional(v.string()), // Error message if transcription failed
      audioMetadata: v.optional(v.object({
        duration: v.optional(v.number()), // Audio duration in seconds
        fileSize: v.optional(v.number()), // File size in bytes
        format: v.string(), // Audio format/content type
      })),
    })),
    
    // Structured state snapshot for processing tracking
    stateSnapshot: v.optional(v.object({
      twilioPayload: v.object({
        MessageSid: v.string(),
        AccountSid: v.string(),
        From: v.string(),
        To: v.string(),
        Body: v.optional(v.string()),
        MediaUrl0: v.optional(v.string()),
        MediaContentType0: v.optional(v.string())
      }),
      processingState: v.object({
        received: v.number(),
        processed: v.optional(v.number()),
        responded: v.optional(v.number())
      })
    })),
    
    // Stable conversation identifiers for linking messages to conversations
    participantId: v.id("participants"), // Link to participant record (required)
    conversationId: v.id("conversations"), // Link to conversation record (required)
    threadId: v.optional(v.string()), // Convex Agent thread reference for AI context
  })
    // Primary lookup indexes
    .index("by_message_id", ["messageId"])
    .index("by_participant", ["participantId"])
    .index("by_conversation", ["conversationId"])
    .index("by_thread", ["threadId"])
    
    // Status and direction indexes for filtering
    .index("by_status", ["status"])
    .index("by_direction", ["direction"]),

  whatsappContacts: defineTable({
    phoneNumber: v.string(), // Phone number with whatsapp: prefix
    name: v.optional(v.string()), // Contact name
    lastMessageTime: v.optional(v.number()), // Last message timestamp
    isActive: v.boolean(), // Whether contact is active
  })
    .index("by_phone", ["phoneNumber"])
    .index("by_active", ["isActive"]),



  // Interview & Admin tables
  participants: defineTable({
    phone: v.string(), // Phone number with whatsapp: prefix
    name: v.optional(v.string()), // Participant name
    consent: v.boolean(), // LGPD consent given
    clusterId: v.optional(v.id("clusters")), // Cluster assignment
    tags: v.array(v.string()), // Custom tags
    createdAt: v.number(), // Registration timestamp
    threadId: v.optional(v.string()), // Active conversation thread ID for context persistence
    
    // Professional information fields
    cargo: v.optional(v.string()), // Job position/role
    empresa: v.optional(v.string()), // Company name
    setor: v.optional(v.string()), // Industry sector
  })
    .index("by_phone", ["phone"])
    .index("by_cluster", ["clusterId"])
    .index("by_consent", ["consent"])
    .index("by_created", ["createdAt"])
    .index("by_thread", ["threadId"])
    .index("by_cargo", ["cargo"])
    .index("by_empresa", ["empresa"])
    .index("by_setor", ["setor"])
    .index("by_empresa_setor", ["empresa", "setor"]),

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
    // Variable mapping configuration
    variableMappings: v.optional(v.array(v.object({
      templateVariable: v.string(), // Variable name in template (e.g., "nome", "telefone")
      participantField: v.string(), // Field in participant table (e.g., "name", "phone")
      defaultValue: v.optional(v.string()), // Default value if field is empty
      isRequired: v.boolean(), // Whether this mapping is required
    }))),
    // Template structure from Twilio
    twilioStructure: v.optional(v.object({
      friendlyName: v.string(),
      language: v.string(),
      variables: v.array(v.object({
        key: v.string(),
        type: v.string(),
      })),
      body: v.optional(v.string()), // Template body text
      lastFetched: v.number(), // When structure was last fetched
    })),
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
