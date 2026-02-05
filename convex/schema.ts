import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  // Multi-tenant architecture tables
  tenants: defineTable({
    name: v.string(), // Tenant name (e.g., "Singuê", "Pactuá")
    slug: v.string(), // URL-friendly identifier
    description: v.optional(v.string()), // Tenant description
    settings: v.object({
      timezone: v.string(), // Tenant timezone
      locale: v.string(), // Default locale (pt-BR, en-US)
      branding: v.optional(v.object({
        primaryColor: v.string(),
        logoUrl: v.optional(v.string()),
        companyName: v.string(),
      })),
    }),
    isActive: v.boolean(), // Whether tenant is active
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_active", ["isActive"])
    .index("by_created", ["createdAt"]),

  bots: defineTable({
    tenantId: v.id("tenants"), // Link to tenant
    name: v.string(), // Bot name (e.g., "Interview Bot", "Billing Bot")
    type: v.union(
      v.literal("interview"),
      v.literal("billing"),
      v.literal("support"),
      v.literal("custom")
    ), // Bot purpose/type
    description: v.optional(v.string()), // Bot description
    config: v.object({
      personality: v.optional(v.string()), // AI personality prompt
      maxTokens: v.optional(v.number()), // Token limit per response
      temperature: v.optional(v.number()), // AI creativity setting
      model: v.optional(v.string()), // AI model to use
      fallbackMessage: v.optional(v.string()), // Fallback when AI fails
      enableRAG: v.boolean(), // Whether to use RAG
      ragNamespace: v.optional(v.string()), // RAG namespace for this bot
    }),
    isActive: v.boolean(), // Whether bot is active
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_type", ["type"])
    .index("by_active", ["isActive"])
    .index("by_tenant_type", ["tenantId", "type"]),

  channels: defineTable({
    tenantId: v.id("tenants"), // Link to tenant
    botId: v.id("bots"), // Link to bot
    type: v.union(
      v.literal("whatsapp"),
      v.literal("telegram"),
      v.literal("web"),
      v.literal("api")
    ), // Channel type
    name: v.string(), // Channel name
    config: v.object({
      // WhatsApp specific config
      twilioAccountSid: v.optional(v.string()),
      twilioAuthToken: v.optional(v.string()),
      twilioPhoneNumber: v.optional(v.string()),
      
      // Telegram specific config
      telegramBotToken: v.optional(v.string()),
      
      // Web specific config
      webOrigins: v.optional(v.array(v.string())),
      
      // Generic config
      webhookUrl: v.optional(v.string()),
      apiKey: v.optional(v.string()),
    }),
    isActive: v.boolean(), // Whether channel is active
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_bot", ["botId"])
    .index("by_type", ["type"])
    .index("by_active", ["isActive"])
    .index("by_tenant_bot", ["tenantId", "botId"]),

  // Generic contact table (replaces whatsappContacts)
  genericContacts: defineTable({
    tenantId: v.id("tenants"), // Link to tenant
    channelId: v.id("channels"), // Link to channel
    externalId: v.string(), // Channel-specific ID (phone, telegram user ID, etc.)
    name: v.optional(v.string()), // Contact name
    metadata: v.optional(v.any()), // Channel-specific metadata
    lastMessageTime: v.optional(v.number()), // Last message timestamp
    isActive: v.boolean(), // Whether contact is active
    createdAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_channel", ["channelId"])
    .index("by_external_id", ["externalId"])
    .index("by_channel_external", ["channelId", "externalId"])
    .index("by_active", ["isActive"]),

  // Generic conversation table (replaces conversations)
  genericConversations: defineTable({
    tenantId: v.id("tenants"), // Link to tenant
    botId: v.id("bots"), // Link to bot
    channelId: v.id("channels"), // Link to channel
    contactId: v.id("genericContacts"), // Link to contact
    participantId: v.optional(v.id("participants")), // Link to participant (for backward compatibility)
    threadId: v.optional(v.string()), // AI thread ID
    state: v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("completed"),
      v.literal("archived")
    ), // Conversation state
    context: v.optional(v.any()), // Conversation context/state
    openedAt: v.number(), // Conversation start
    lastMessageAt: v.number(), // Last message timestamp
    closedAt: v.optional(v.number()), // Conversation end
  })
    .index("by_tenant", ["tenantId"])
    .index("by_bot", ["botId"])
    .index("by_channel", ["channelId"])
    .index("by_contact", ["contactId"])
    .index("by_participant", ["participantId"])
    .index("by_thread", ["threadId"])
    .index("by_state", ["state"])
    .index("by_last_message", ["lastMessageAt"]),

  // Generic message table (replaces whatsappMessages)
  genericMessages: defineTable({
    tenantId: v.id("tenants"), // Link to tenant
    conversationId: v.id("genericConversations"), // Link to conversation
    externalId: v.optional(v.string()), // Channel-specific message ID
    direction: v.union(v.literal("inbound"), v.literal("outbound")), // Message direction
    content: v.object({
      text: v.optional(v.string()), // Text content
      mediaUrl: v.optional(v.string()), // Media URL
      mediaType: v.optional(v.string()), // Media content type
      metadata: v.optional(v.any()), // Channel-specific metadata
    }),
    status: v.union(
      v.literal("received"),
      v.literal("processing"),
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("read"),
      v.literal("failed")
    ), // Message status
    aiMetadata: v.optional(v.object({
      model: v.string(),
      tokens: v.number(),
      processingTimeMs: v.number(),
      fallbackUsed: v.boolean(),
      timestamp: v.number(),
      threadId: v.optional(v.string()),
      context: v.optional(v.any()), // AI context snapshot
    })),
    rawData: v.optional(v.any()), // Raw channel data (Twilio, Telegram, etc.)
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_tenant", ["tenantId"])
    .index("by_conversation", ["conversationId"])
    .index("by_external_id", ["externalId"])
    .index("by_direction", ["direction"])
    .index("by_status", ["status"])
    .index("by_created", ["createdAt"]),

  // Enhanced WhatsApp message table with normalized structure (LEGACY - for backward compatibility)
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

    // External tracking ID (from survey/form system)
    externalId: v.optional(v.string()), // Original survey/form ID for import tracking
    importSource: v.optional(v.string()), // CSV filename for filtering imports

    // Professional information fields
    cargo: v.optional(v.string()), // Job position/role
    empresa: v.optional(v.string()), // Company name (free text)
    empresaPrograma: v.optional(v.string()), // Company name from program dropdown (more reliable)
    setor: v.optional(v.string()), // Industry sector

    // Demographic and program fields (for CSV import)
    email: v.optional(v.string()), // Professional email
    estado: v.optional(v.string()), // Brazilian state
    raca: v.optional(v.string()), // Race/ethnicity
    genero: v.optional(v.string()), // Gender identity
    annosCarreira: v.optional(v.string()), // Years of career experience
    senioridade: v.optional(v.string()), // Seniority level
    linkedin: v.optional(v.string()), // LinkedIn URL
    tipoOrganizacao: v.optional(v.string()), // Organization type
    programaMarca: v.optional(v.string()), // Program brand (FIB, TEMPLO, MOVER 1, etc)
    receitaAnual: v.optional(v.string()), // Annual revenue range

    // Additional identity and verification fields
    transgenero: v.optional(v.boolean()), // Transgender identity
    pais: v.optional(v.string()), // Country of origin
    portfolioUrl: v.optional(v.string()), // Portfolio or personal website URL

    // Program-specific flags for segmentation
    blackSisterInLaw: v.optional(v.boolean()), // Black Sister in Law membership
    mercadoFinanceiro: v.optional(v.boolean()), // Works in financial market
    membroConselho: v.optional(v.boolean()), // Board member status
    programasPactua: v.optional(v.string()), // Previous Pactuá programs
    programasSingue: v.optional(v.string()), // Previous Singuê programs
  })
    .index("by_phone", ["phone"])
    .index("by_cluster", ["clusterId"])
    .index("by_consent", ["consent"])
    .index("by_created", ["createdAt"])
    .index("by_thread", ["threadId"])
    .index("by_cargo", ["cargo"])
    .index("by_empresa", ["empresa"])
    .index("by_setor", ["setor"])
    .index("by_empresa_setor", ["empresa", "setor"])
    .index("by_email", ["email"])
    .index("by_programa_marca", ["programaMarca"])
    .index("by_estado", ["estado"])
    .index("by_external_id", ["externalId"]) // Critical for deduplication
    .index("by_import_source", ["importSource"]), // Filter by CSV filename

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

  participant_profiles: defineTable({
    participantId: v.id("participants"), // Link to participant
    realizacoes: v.optional(v.string()), // Professional achievements and impact
    visaoFuturo: v.optional(v.string()), // Career vision for next 5 years
    desafiosSuperados: v.optional(v.string()), // Barriers overcome in career
    desafiosAtuais: v.optional(v.string()), // Current challenges for career growth
    motivacao: v.optional(v.string()), // Motivation for joining program
  })
    .index("by_participant", ["participantId"]),

  // Note: Participant embeddings are now managed by Convex RAG (@convex-dev/rag)
  // See convex/functions/participantRAG.ts for implementation
  // This eliminates ~500 lines of custom vector search code

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

  // Enhanced knowledge_docs table with tenant/bot isolation
  knowledge_docs: defineTable({
    tenantId: v.optional(v.id("tenants")), // Link to tenant (optional for backward compatibility)
    botId: v.optional(v.id("bots")), // Link to bot (optional for backward compatibility)
    namespace: v.optional(v.string()), // RAG namespace (for multi-tenant isolation)
    title: v.string(), // Document title
    source: v.string(), // Source file/URL
    tags: v.array(v.string()), // Document tags
    status: v.union(v.literal("ingested"), v.literal("pending"), v.literal("failed")), // Processing status
    createdAt: v.number(), // Upload timestamp
  })
    .index("by_tenant", ["tenantId"])
    .index("by_bot", ["botId"])
    .index("by_namespace", ["namespace"])
    .index("by_status", ["status"])
    .index("by_created", ["createdAt"])
    .index("by_tags", ["tags"])
    .index("by_tenant_bot", ["tenantId", "botId"]),

  knowledge_chunks: defineTable({
    docId: v.id("knowledge_docs"), // Link to source document
    tenantId: v.optional(v.id("tenants")), // Link to tenant (denormalized for performance)
    botId: v.optional(v.id("bots")), // Link to bot (denormalized for performance)
    namespace: v.optional(v.string()), // RAG namespace (denormalized for performance)
    chunk: v.string(), // Text chunk content
    embedding: v.array(v.float64()), // Vector embedding
    tags: v.object({
      asa: v.optional(v.string()), // ASA category
      tema: v.optional(v.string()), // Theme/topic
      nivel: v.optional(v.string()), // Level/difficulty
    }),
  })
    .index("by_doc", ["docId"])
    .index("by_tenant", ["tenantId"])
    .index("by_bot", ["botId"])
    .index("by_namespace", ["namespace"])
    .vectorIndex("by_namespace_embedding", {
      vectorField: "embedding",
      dimensions: 3072, // text-embedding-3-large dimensions
      filterFields: ["namespace"],
    }),

  clusters: defineTable({
    name: v.string(), // Cluster name
    description: v.string(), // Cluster description
    rules: v.optional(v.any()), // Clustering rules (JSON)
  })
    .index("by_name", ["name"]),

  // Cache for UMAP reduced embeddings
  umap_embeddings_cache: defineTable({
    participantId: v.id("participants"),
    x: v.float64(), // UMAP-2D coordinate X (for visualization)
    y: v.float64(), // UMAP-2D coordinate Y (for visualization)
    embedding: v.array(v.float64()), // Original embedding (1536D)
    clusteringEmbedding: v.optional(v.array(v.float64())), // UMAP-50D for clustering (preserves more info) - optional for migration
    metadata: v.object({
      name: v.optional(v.string()),
      cargo: v.optional(v.string()),
      empresa: v.optional(v.string()),
      setor: v.optional(v.string()),
      programaMarca: v.optional(v.string()),
    }),
    version: v.string(), // Cache version (para invalidar quando necessário)
    createdAt: v.number(),
  })
    .index("by_participant", ["participantId"])
    .index("by_version", ["version"])
    .index("by_created", ["createdAt"]),

  // Cache for clustering results (to avoid recalculating on every page load)
  cluster_results_cache: defineTable({
    points: v.any(), // Array of cluster points (compressed JSON)
    clusterStats: v.any(), // Array of cluster statistics
    totalParticipants: v.number(),
    parameters: v.object({
      minClusterSize: v.number(),
      minSamples: v.number(),
    }),
    umapCacheVersion: v.string(), // Link to UMAP cache version used
    createdAt: v.number(),
    expiresAt: v.optional(v.number()), // Optional TTL for cache invalidation
  })
    .index("by_created", ["createdAt"])
    .index("by_umap_version", ["umapCacheVersion"]),

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
