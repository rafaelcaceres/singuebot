import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

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
    
    const uniquePhones = new Set(recentMessages.map(m => m.from));
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
          .withIndex("by_from", (q) => q.eq("from", participant.phone))
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

export const deleteParticipant = mutation({
  args: {
    participantId: v.id("participants"),
  },
  handler: async (ctx, args) => {
    // Delete participant and related data for LGPD compliance
    const participant = await ctx.db.get(args.participantId);
    if (!participant) return;

    // Delete interview session
    const session = await ctx.db
      .query("interview_sessions")
      .withIndex("by_participant", (q) => q.eq("participantId", args.participantId))
      .first();
    if (session) {
      await ctx.db.delete(session._id);
    }

    // Delete conversation
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_participant", (q) => q.eq("participantId", args.participantId))
      .first();
    if (conversation) {
      await ctx.db.delete(conversation._id);
    }

    // Delete messages
    const messages = await ctx.db
      .query("whatsappMessages")
      .withIndex("by_from", (q) => q.eq("from", participant.phone))
      .collect();
    
    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // Delete AI interactions
    const aiInteractions = await ctx.db
      .query("aiInteractions")
      .withIndex("by_phone", (q) => q.eq("phoneNumber", participant.phone))
      .collect();
    
    for (const interaction of aiInteractions) {
      await ctx.db.delete(interaction._id);
    }

    // Finally delete the participant
    await ctx.db.delete(args.participantId);
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
      .withIndex("by_from", (q) => q.eq("from", participant.phone))
      .order("desc")
      .take(args.limit || 100);

    // Also get messages TO the participant
    const outboundMessages = await ctx.db
      .query("whatsappMessages")
      .withIndex("by_to", (q) => q.eq("to", participant.phone))
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
      from: "whatsapp:+5511999999999", // System number
      to: participant.phone,
      body: args.message,
      status: "queued",
      direction: "outbound",
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
        .withIndex("by_from", (q) => q.eq("from", participant.phone))
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

export const uploadKnowledgeDocument = mutation({
  args: {
    title: v.string(),
    source: v.string(),
    tags: v.array(v.string()),
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

    // TODO: Trigger background processing job
    // This would typically schedule a job to process the document
    // For now, we'll mark it as ingested immediately
    await ctx.db.patch(documentId, {
      status: "ingested",
    });

    return documentId;
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
    // Mark document for reprocessing
    await ctx.db.patch(args.documentId, {
      status: "pending",
    });

    // TODO: Trigger background reprocessing job
    // For now, simulate completion
    await ctx.db.patch(args.documentId, {
      status: "ingested",
    });
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