import { v } from "convex/values";
import { query, mutation, internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { rag } from "./functions/rag";

// Helper function to get or create conversation for participant
const getOrCreateConversation = async (ctx: any, participantId: any) => {
  const existingConversation = await ctx.db
    .query("conversations")
    .withIndex("by_participant", (q: any) => q.eq("participantId", participantId))
    .first();
  
  if (existingConversation) {
    return existingConversation._id;
  }
  
  // Create new conversation
  return await ctx.db.insert("conversations", {
    participantId,
    channel: "whatsapp" as const,
    openedAt: Date.now(),
    lastMessageAt: Date.now(),
    isOpen: true,
  });
};

// Organizer Management Functions

export const getOrganizerByEmail = query({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const organizer = await ctx.db
      .query("organizers")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();
    
    return organizer;
  },
});

// Template Management Functions

export const getTemplates = query({
  args: {},
  handler: async (ctx): Promise<any[]> => {
    return await ctx.runQuery(internal.functions.twilio_db.listTemplates);
  },
});

export const createTemplate = mutation({
  args: {
    name: v.string(),
    content: v.string(),
    twilioId: v.string(),
    variables: v.array(v.string()),
    locale: v.string(),
    stage: v.string(),
  },
  handler: async (ctx, args): Promise<any> => {
    return await ctx.runMutation(internal.functions.twilio_db.createTemplate, {
      name: args.name,
      locale: args.locale,
      twilioId: args.twilioId,
      variables: args.variables,
      stage: args.stage,
    });
  },
});

export const updateTemplate = mutation({
  args: {
    templateId: v.id("templates"),
    updates: v.object({
      name: v.optional(v.string()),
      content: v.optional(v.string()),
      twilioId: v.optional(v.string()),
      variables: v.optional(v.array(v.string())),
      locale: v.optional(v.string()),
      stage: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args): Promise<any> => {
    return await ctx.runMutation(internal.functions.twilio_db.updateTemplate, args);
  },
});

export const deleteTemplate = mutation({
  args: {
    templateId: v.id("templates"),
  },
  handler: async (ctx, args): Promise<any> => {
    return await ctx.runMutation(internal.functions.twilio_db.deleteTemplate, args);
  },
});

export const getOrganizers = query({
  args: {},
  handler: async (ctx) => {
    const organizers = await ctx.db
      .query("organizers")
      .collect();
    
    return organizers;
  },
});

export const upsertOrganizer = mutation({
  args: {
    email: v.string(),
    role: v.union(v.literal("owner"), v.literal("editor"), v.literal("viewer")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("organizers")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) {
      // Update existing organizer
      await ctx.db.patch(existing._id, {
        role: args.role,
      });
      return existing._id;
    } else {
      // Create new organizer
      const organizerId = await ctx.db.insert("organizers", {
        email: args.email,
        role: args.role,
      });
      return organizerId;
    }
  },
});

export const deleteOrganizer = mutation({
  args: {
    organizerId: v.id("organizers"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.organizerId);
  },
});

// Dashboard KPI Functions

export const getDashboardKPIs = query({
  args: {},
  handler: async (ctx) => {
    // Get total participants
    const totalParticipants = await ctx.db
      .query("participants")
      .collect()
      .then(participants => participants.length);

    // Get active participants in last 24h
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    const recentMessages = await ctx.db
      .query("whatsappMessages")
      .filter((q) => q.gte(q.field("_creationTime"), oneDayAgo))
      .collect();
    
    const uniquePhones = new Set(recentMessages.map(m => m.stateSnapshot?.twilioPayload?.From).filter(Boolean));
    const active24h = uniquePhones.size;

    // Calculate response rate (placeholder - needs proper implementation)
    const responseRate = 85.2;

    // Calculate p95 latency (placeholder - needs proper implementation)
    const p95Latency = 1.2;

    return {
      totalParticipants,
      active24h,
      responseRate,
      p95Latency,
    };
  },
});

// Participant Management Functions

export const getParticipants = query({
  args: {
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
    clusterId: v.optional(v.id("clusters")),
    consent: v.optional(v.boolean()),
    stage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Build query with most selective index first
    let participants;
    
    if (args.clusterId) {
      // Use cluster index (likely most selective)
      participants = await ctx.db
        .query("participants")
        .withIndex("by_cluster", (q) => q.eq("clusterId", args.clusterId))
        .collect();
      
      // Apply consent filter in memory if needed
       if (args.consent !== undefined) {
         participants = participants.filter(p => p.consent === args.consent!);
      }
    } else if (args.consent !== undefined) {
      // Use consent index
      participants = await ctx.db
        .query("participants")
        .withIndex("by_consent", (q) => q.eq("consent", args.consent!))
        .collect();
    } else {
      // No filters - use creation time index for better performance
      participants = await ctx.db
        .query("participants")
        .withIndex("by_created")
        .collect();
    }

    // Filter by stage if provided (requires checking interview_sessions)
    let filteredParticipants = participants;
    if (args.stage) {
      const sessions = await ctx.db
        .query("interview_sessions")
        .withIndex("by_step", (q) => args.stage ? q.eq("step", args.stage) : q)
        .collect();
      
      const participantIds = new Set(sessions.map(s => s.participantId));
      filteredParticipants = participants.filter(p => participantIds.has(p._id));
    }

    // Apply pagination
    const offset = args.offset || 0;
    const limit = args.limit || 50;
    const paginatedParticipants = filteredParticipants.slice(offset, offset + limit);

    // Get additional data for each participant
    const enrichedParticipants = await Promise.all(
      paginatedParticipants.map(async (participant) => {
        // Get current interview session
        const session = await ctx.db
          .query("interview_sessions")
          .withIndex("by_participant", (q) => q.eq("participantId", participant._id))
          .first();

        // Get last message time
        const lastMessage = await ctx.db
          .query("whatsappMessages")
          .withIndex("by_participant", (q) => q.eq("participantId", participant._id))
          .order("desc")
          .first();

        // Get cluster info
        let cluster = null;
        if (participant.clusterId) {
          cluster = await ctx.db.get(participant.clusterId);
        }

        return {
          ...participant,
          currentStage: session?.step || "not_started",
          lastMessageAt: lastMessage?._creationTime,
          cluster: cluster ? { id: cluster._id, name: cluster.name } : null,
        };
      })
    );

    return {
      participants: enrichedParticipants,
      total: filteredParticipants.length,
      hasMore: offset + limit < filteredParticipants.length,
    };
  },
});

export const getParticipantById = query({
  args: {
    participantId: v.id("participants"),
  },
  handler: async (ctx, args) => {
    const participant = await ctx.db.get(args.participantId);
    if (!participant) return null;

    // Get interview session
    const session = await ctx.db
      .query("interview_sessions")
      .withIndex("by_participant", (q) => q.eq("participantId", args.participantId))
      .first();

    // Get cluster info
    let cluster = null;
    if (participant.clusterId) {
      cluster = await ctx.db.get(participant.clusterId);
    }

    // Get conversation
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_participant", (q) => q.eq("participantId", args.participantId))
      .first();

    return {
      ...participant,
      session,
      cluster,
      conversation,
    };
  },
});

export const createParticipant = mutation({
  args: {
    phone: v.string(),
    name: v.optional(v.string()),
    clusterId: v.optional(v.id("clusters")),
    cargo: v.optional(v.string()),
    empresa: v.optional(v.string()),
    setor: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    // Validate and format phone number
    const phoneRegex = /^\+\d{10,15}$/;
    if (!phoneRegex.test(args.phone)) {
      throw new Error("Phone number must be in format '+1234567890'");
    }

    // Format phone number with whatsapp prefix
    const formattedPhone = `whatsapp:${args.phone}`;

    // Check if participant already exists
    const existingParticipant = await ctx.db
      .query("participants")
      .withIndex("by_phone", (q) => q.eq("phone", formattedPhone))
      .first();

    if (existingParticipant) {
      throw new Error("Participant with this phone number already exists");
    }

    // Create new participant
    const participantId = await ctx.db.insert("participants", {
      phone: formattedPhone,
      name: args.name,
      consent: false, // Default to false, can be updated later
      clusterId: args.clusterId,
      cargo: args.cargo,
      empresa: args.empresa,
      setor: args.setor,
      tags: args.tags || [],
      createdAt: Date.now(),
    });

    // Create initial conversation for the participant
    await getOrCreateConversation(ctx, participantId);

    return participantId;
  },
});

export const updateParticipant = mutation({
  args: {
    participantId: v.id("participants"),
    updates: v.object({
      name: v.optional(v.string()),
      consent: v.optional(v.boolean()),
      clusterId: v.optional(v.id("clusters")),
      cargo: v.optional(v.string()),
      empresa: v.optional(v.string()),
      setor: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
    }),
  },
  handler: async (ctx, args) => {
    // Check if participant exists
    const participant = await ctx.db.get(args.participantId);
    if (!participant) {
      throw new Error("Participant not found");
    }

    // Update participant
    await ctx.db.patch(args.participantId, args.updates);

    return args.participantId;
  },
});

export const deleteParticipant = mutation({
  args: {
    participantId: v.id("participants"),
  },
  handler: async (ctx, args) => {
    // Get participant to check if exists
    const participant = await ctx.db.get(args.participantId);
    if (!participant) {
      throw new Error("Participant not found");
    }

    // Delete all related conversations first
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_participant", (q) => q.eq("participantId", args.participantId))
      .collect();

    for (const conversation of conversations) {
      // Delete all messages in this conversation
      const messages = await ctx.db
        .query("whatsappMessages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", conversation._id))
        .collect();

      for (const message of messages) {
        await ctx.db.delete(message._id);
      }

      // Delete the conversation
      await ctx.db.delete(conversation._id);
    }

    // Delete interview sessions
    const interviewSessions = await ctx.db
      .query("interview_sessions")
      .withIndex("by_participant", (q) => q.eq("participantId", args.participantId))
      .collect();

    for (const session of interviewSessions) {
      await ctx.db.delete(session._id);
    }

    // Finally delete the participant
    await ctx.db.delete(args.participantId);

    return { success: true };
  },
});

// Conversation Management Functions

export const getConversationMessages = query({
  args: {
    participantId: v.id("participants"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const participant = await ctx.db.get(args.participantId);
    if (!participant) return { messages: [], participant: null };

    const messages = await ctx.db
      .query("whatsappMessages")
      .filter(q => q.eq(q.field("stateSnapshot.twilioPayload.From"), participant.phone))
      .order("desc")
      .take(args.limit || 100);

    // Also get messages TO the participant
    const outboundMessages = await ctx.db
      .query("whatsappMessages")
      .filter(q => q.eq(q.field("stateSnapshot.twilioPayload.To"), participant.phone))
      .order("desc")
      .take(args.limit || 100);

    // Combine and sort all messages
    const allMessages = [...messages, ...outboundMessages]
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, args.limit || 100);

    return {
      messages: allMessages,
      participant,
    };
  },
});

export const sendManualMessage = mutation({
  args: {
    participantId: v.id("participants"),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const participant = await ctx.db.get(args.participantId);
    if (!participant) throw new Error("Participant not found");

    // Create outbound message record
    const messageId = await ctx.db.insert("whatsappMessages", {
      messageId: `manual_${Date.now()}`,
      body: args.message,
      status: "sent",
      direction: "outbound",
      messageType: "outbound",
      participantId: args.participantId,
      conversationId: await getOrCreateConversation(ctx, args.participantId),
      stateSnapshot: {
        twilioPayload: {
          MessageSid: `manual_${Date.now()}`,
          AccountSid: "manual",
          From: "whatsapp:+5511999999999", // System number
          To: participant.phone,
          Body: args.message,
        },
        processingState: {
          received: Date.now(),
          processed: Date.now(),
          responded: Date.now(),
        }
      }
    });

    // TODO: Integrate with Twilio to actually send the message
    // For now, just return the message ID
    return messageId;
  },
});

export const getConversations = query({
  args: {
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
    clusterId: v.optional(v.id("clusters")),
    stage: v.optional(v.string()),
    hasUnread: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 25;
    const offset = args.offset || 0;

    // Get all participants
    const participants = await ctx.db.query("participants").collect();
    
    // Filter by cluster if specified
    let filteredParticipants = participants;
    if (args.clusterId) {
      filteredParticipants = participants.filter(p => p.clusterId === args.clusterId);
    }

    // Get conversation data for each participant
    const conversationsPromises = filteredParticipants.map(async (participant) => {
      const messages = await ctx.db
        .query("whatsappMessages")
        .withIndex("by_participant", (q) => q.eq("participantId", participant._id))
        .order("desc")
        .collect();

      const unreadCount = messages.filter(m => 
        m.direction === "inbound" && m.status !== "read"
      ).length;

      const lastMessage = messages[0];
      
      // Get cluster info
      const cluster = participant.clusterId 
        ? await ctx.db.get(participant.clusterId)
        : null;

      return {
        _id: participant._id,
        participantId: participant._id,
        participantName: participant.name,
        participantPhone: participant.phone,
        lastMessageAt: lastMessage?._creationTime || participant._creationTime,
        messageCount: messages.length,
        unreadCount,
        currentStage: "intro", // Default stage since it's not in the schema
        cluster: cluster ? { id: cluster._id, name: cluster.name } : null,
        consent: participant.consent,
      };
    });

    const conversations = await Promise.all(conversationsPromises);
    
    // Filter by stage if specified (using default stage for now)
    let filteredConversations = conversations;
    if (args.stage) {
      filteredConversations = conversations.filter(c => c.currentStage === args.stage);
    }
    
    // Filter by unread status if specified
    if (args.hasUnread !== undefined) {
      filteredConversations = filteredConversations.filter(c => 
        args.hasUnread ? c.unreadCount > 0 : c.unreadCount === 0
      );
    }

    // Sort by last message time (most recent first)
    filteredConversations.sort((a, b) => b.lastMessageAt - a.lastMessageAt);

    // Apply pagination
    const paginatedConversations = filteredConversations.slice(offset, offset + limit);

    return {
      conversations: paginatedConversations,
      total: filteredConversations.length,
    };
  },
});

export const getClusters = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("clusters").collect();
  },
});

// Knowledge Management Functions

export const getKnowledgeDocuments = query({
  args: {},
  handler: async (ctx) => {
    const documents = await ctx.db
      .query("knowledge_docs")
      .withIndex("by_created")
      .order("desc")
      .collect();
    
    return documents.map(doc => ({
      _id: doc._id,
      title: doc.title,
      source: doc.source,
      status: doc.status,
      tags: doc.tags,
      uploadedAt: doc._creationTime,
      createdAt: doc.createdAt,
    }));
  },
});

export const getKnowledgeDocumentById = query({
  args: {
    documentId: v.id("knowledge_docs"),
  },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new Error("Document not found");
    }
    
    return {
      _id: document._id,
      title: document.title,
      source: document.source,
      status: document.status,
      tags: document.tags,
      uploadedAt: document._creationTime,
      createdAt: document.createdAt,
    };
  },
});

export const updateKnowledgeDocument = mutation({
  args: {
    documentId: v.id("knowledge_docs"),
    updates: v.object({
      title: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
    }),
  },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new Error("Document not found");
    }

    await ctx.db.patch(args.documentId, args.updates);
    return args.documentId;
  },
});

export const getKnowledgeDocumentStats = query({
  args: {},
  handler: async (ctx) => {
    const documents = await ctx.db.query("knowledge_docs").collect();
    
    const stats = {
      total: documents.length,
      ingested: documents.filter(doc => doc.status === "ingested").length,
      pending: documents.filter(doc => doc.status === "pending").length,
      failed: documents.filter(doc => doc.status === "failed").length,
      totalTags: [...new Set(documents.flatMap(doc => doc.tags))].length,
    };
    
    return stats;
  },
});

export const uploadKnowledgeDocument = mutation({
  args: {
    title: v.string(),
    source: v.string(),
    tags: v.array(v.string()),
    content: v.string(),
    format: v.union(v.literal("pdf"), v.literal("txt"), v.literal("md")),
    hash: v.string(),
  },
  handler: async (ctx, args) => {
    // Insert document record
    const documentId = await ctx.db.insert("knowledge_docs", {
      title: args.title,
      source: args.source,
      tags: args.tags,
      status: "pending",
      createdAt: Date.now(),
    });

    // Schedule RAG processing asynchronously
    await ctx.scheduler.runAfter(0, internal.admin.processDocumentForRAG, {
      documentId,
      content: args.content,
      title: args.title,
      format: args.format,
      hash: args.hash,
    });

    return documentId;
  },
});

// Internal action to process documents for RAG
export const processDocumentForRAG = internalAction({
  args: {
    documentId: v.id("knowledge_docs"),
    content: v.string(),
    title: v.string(),
    format: v.union(v.literal("pdf"), v.literal("txt"), v.literal("md")),
    hash: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // Process document with RAG system directly
      const result = await rag.add(ctx, {
        namespace: "global_knowledge",
        title: args.title,
        contentHash: args.hash,
        text: args.content,
        metadata: {
          format: args.format || "txt",
          uploadedAt: Date.now(),
        },
      });

      // Mark document as successfully ingested
      await ctx.runMutation(internal.admin.updateDocumentStatus, {
        documentId: args.documentId,
        status: "ingested",
      });
      return result;
    } catch (error) {
      console.error("RAG processing failed:", error);
      
      // Mark document as failed
      await ctx.runMutation(internal.admin.updateDocumentStatus, {
        documentId: args.documentId,
        status: "failed",
      });
    }
  },
});

// Internal mutation to update document status
export const updateDocumentStatus = internalMutation({
  args: {
    documentId: v.id("knowledge_docs"),
    status: v.union(v.literal("pending"), v.literal("ingested"), v.literal("failed")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.documentId, {
      status: args.status,
    });
  },
});

export const deleteKnowledgeDocument = mutation({
  args: {
    documentId: v.id("knowledge_docs"),
  },
  handler: async (ctx, args) => {
    // Delete associated chunks first
    const chunks = await ctx.db
      .query("knowledge_chunks")
      .withIndex("by_doc", (q) => q.eq("docId", args.documentId))
      .collect();
    
    for (const chunk of chunks) {
      await ctx.db.delete(chunk._id);
    }

    // Delete the document
    await ctx.db.delete(args.documentId);
  },
});

export const reindexDocument = mutation({
  args: {
    documentId: v.id("knowledge_docs"),
  },
  handler: async (ctx, args) => {
    // Get the document
    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new Error("Document not found");
    }

    // Mark as pending and schedule reprocessing
    await ctx.db.patch(args.documentId, {
      status: "pending",
    });

    // Note: We would need to store the original content to reindex
    // For now, we'll just mark it as ingested
    // In a full implementation, we'd store the content and reprocess it
    await ctx.db.patch(args.documentId, {
      status: "ingested",
    });

    return args.documentId;
  },
});

export const reindexAllDocuments = mutation({
  args: {},
  handler: async (ctx) => {
    const documents = await ctx.db
      .query("knowledge_docs")
      .collect();

    for (const doc of documents) {
      await ctx.db.patch(doc._id, {
        status: "pending",
      });
    }

    // TODO: Trigger background reprocessing jobs for all documents
  },
});

export const getProcessingJobs = query({
  args: {},
  handler: async (ctx) => {
    // For now, return pending documents as jobs
    const pendingDocs = await ctx.db
      .query("knowledge_docs")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    return pendingDocs.map(doc => ({
      _id: doc._id,
      title: doc.title,
      status: "processing",
      progress: 50, // Placeholder progress
      currentStep: "Processando chunks...",
    }));
  },
});