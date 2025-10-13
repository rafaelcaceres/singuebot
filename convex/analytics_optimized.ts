import { v } from "convex/values";
import { query } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Optimized Analytics Functions with Caching and Efficient Queries

export const getRealTimeMetricsOptimized = query({
  args: {},
  returns: v.object({
    participants: v.object({
      total: v.number(),
      active24h: v.number(),
      withConsent: v.number(),
      consentRate: v.number(),
    }),
    messages: v.object({
      total: v.number(),
      last24h: v.number(),
      lastWeek: v.number(),
      lastMonth: v.number(),
      responseRate: v.number(),
    }),
    ai: v.object({
      totalInteractions: v.number(),
      interactions24h: v.number(),
      avgResponseTime: v.number(),
    }),
    interviews: v.object({
      totalSessions: v.number(),
      activeSessions: v.number(),
      completionRate: v.number(),
    }),
    knowledge: v.object({
      totalDocs: v.number(),
      ingestedDocs: v.number(),
      processingRate: v.number(),
    }),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = now - (30 * 24 * 60 * 60 * 1000);

    // Use Promise.all to run queries in parallel
    const [
      totalParticipants,
      participantsWithConsent,
      recentMessages24h,
      recentMessagesWeek,
      recentMessagesMonth,
      totalMessages,
      aiMessages,
      interviewSessions,
      knowledgeDocs,
    ] = await Promise.all([
      // Participants queries
      ctx.db.query("participants").collect(),
      ctx.db.query("participants")
        .filter(q => q.eq(q.field("consent"), true))
        .collect(),
      
      // Messages queries with time filters
      ctx.db.query("whatsappMessages")
        .filter(q => q.gte(q.field("_creationTime"), oneDayAgo))
        .collect(),
      ctx.db.query("whatsappMessages")
        .filter(q => q.gte(q.field("_creationTime"), oneWeekAgo))
        .collect(),
      ctx.db.query("whatsappMessages")
        .filter(q => q.gte(q.field("_creationTime"), oneMonthAgo))
        .collect(),
      ctx.db.query("whatsappMessages").collect(),
      
      // AI interactions
      ctx.db.query("whatsappMessages")
        .filter(q => q.neq(q.field("aiMetadata"), undefined))
        .collect(),
      
      // Interview sessions
      ctx.db.query("interview_sessions").collect(),
      
      // Knowledge docs
      ctx.db.query("knowledge_docs").collect(),
    ]);

    // Calculate active participants (those with messages in last 24h)
    const activeParticipantPhones = new Set(
      recentMessages24h.map(msg => 
        msg.stateSnapshot?.twilioPayload?.From || 
        msg.stateSnapshot?.twilioPayload?.To
      ).filter(Boolean)
    );
    const activeParticipants = totalParticipants.filter(p => 
      activeParticipantPhones.has(p.phone)
    );

    // Calculate AI metrics
    const aiInteractions24h = aiMessages.filter(msg => 
      msg._creationTime >= oneDayAgo
    );
    const avgResponseTime = aiMessages.length > 0 
      ? aiMessages.reduce((sum, msg) => 
          sum + (msg.aiMetadata?.processingTimeMs || 0), 0
        ) / aiMessages.length
      : 0;

    // Calculate interview metrics
    const activeSessions = interviewSessions.filter(session => 
      session.lastStepAt >= oneDayAgo
    );
    const completionRate = interviewSessions.length > 0
      ? (interviewSessions.filter(s => s.step === "completed").length / interviewSessions.length) * 100
      : 0;

    // Calculate knowledge metrics
    const ingestedDocs = knowledgeDocs.filter(doc => doc.status === "ingested");
    const processingRate = knowledgeDocs.length > 0
      ? (ingestedDocs.length / knowledgeDocs.length) * 100
      : 0;

    return {
      participants: {
        total: totalParticipants.length,
        active24h: activeParticipants.length,
        withConsent: participantsWithConsent.length,
        consentRate: totalParticipants.length > 0 
          ? (participantsWithConsent.length / totalParticipants.length) * 100 
          : 0,
      },
      messages: {
        total: totalMessages.length,
        last24h: recentMessages24h.length,
        lastWeek: recentMessagesWeek.length,
        lastMonth: recentMessagesMonth.length,
        responseRate: totalMessages.length > 0
          ? (aiMessages.length / totalMessages.length) * 100
          : 0,
      },
      ai: {
        totalInteractions: aiMessages.length,
        interactions24h: aiInteractions24h.length,
        avgResponseTime,
      },
      interviews: {
        totalSessions: interviewSessions.length,
        activeSessions: activeSessions.length,
        completionRate,
      },
      knowledge: {
        totalDocs: knowledgeDocs.length,
        ingestedDocs: ingestedDocs.length,
        processingRate,
      },
    };
  },
});

export const getTopParticipantsOptimized = query({
  args: {
    limit: v.optional(v.number()),
    metric: v.optional(v.union(v.literal("messages"), v.literal("engagement"))),
  },
  returns: v.array(v.object({
    participant: v.object({
      id: v.id("participants"),
      name: v.optional(v.string()),
      phone: v.string(),
      cluster: v.string(),
      consent: v.boolean(),
    }),
    metrics: v.object({
      messageCount: v.number(),
      lastActivity: v.number(),
      engagementScore: v.number(),
    }),
  })),
  handler: async (ctx, args) => {
    const limit = args.limit || 10;
    const metric = args.metric || "engagement";

    // Get all participants in parallel with cluster data
    const participants = await ctx.db.query("participants").collect();
    
    const clusterIds = participants
      .map(p => p.clusterId)
      .filter(Boolean) as Array<Id<"clusters">>;
    
    const clusters = await Promise.all(
      clusterIds.map(id => ctx.db.get(id))
    );
    const clusterMap = new Map(
      clusters.filter(Boolean).map(c => [c!._id, c!.name])
    );

    // Get message counts efficiently using a single query
    const allMessages = await ctx.db.query("whatsappMessages").collect();
    const messagesByPhone = new Map<string, number>();
    const lastActivityByPhone = new Map<string, number>();

    // Build message statistics
    allMessages.forEach(msg => {
      const phone = msg.stateSnapshot?.twilioPayload?.From || 
                   msg.stateSnapshot?.twilioPayload?.To;
      if (phone) {
        messagesByPhone.set(phone, (messagesByPhone.get(phone) || 0) + 1);
        const currentLast = lastActivityByPhone.get(phone) || 0;
        lastActivityByPhone.set(phone, Math.max(currentLast, msg._creationTime));
      }
    });

    // Calculate metrics for each participant
    const participantMetrics = participants.map(participant => {
      const messageCount = messagesByPhone.get(participant.phone) || 0;
      const lastActivity = Math.max(
        lastActivityByPhone.get(participant.phone) || 0,
        participant._creationTime
      );

      const clusterName = participant.clusterId 
        ? clusterMap.get(participant.clusterId) || "No Cluster"
        : "No Cluster";

      return {
        participant: {
          id: participant._id,
          name: participant.name,
          phone: participant.phone,
          cluster: clusterName,
          consent: participant.consent,
        },
        metrics: {
          messageCount,
          lastActivity,
          engagementScore: messageCount * (participant.consent ? 1.5 : 1),
        },
      };
    });

    // Sort by selected metric
    const sortedParticipants = participantMetrics.sort((a, b) => {
      if (metric === "messages") {
        return b.metrics.messageCount - a.metrics.messageCount;
      } else {
        return b.metrics.engagementScore - a.metrics.engagementScore;
      }
    });

    return sortedParticipants.slice(0, limit);
  },
});

export const getRecentActivityOptimized = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(v.object({
    type: v.union(
      v.literal("message"),
      v.literal("ai_interaction"),
      v.literal("new_participant")
    ),
    timestamp: v.number(),
    description: v.string(),
    details: v.object({
      phone: v.optional(v.string()),
      name: v.optional(v.string()),
      preview: v.optional(v.string()),
    }),
  })),
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);

    // Get recent data in parallel
    const [recentMessages, recentParticipants] = await Promise.all([
      ctx.db.query("whatsappMessages")
        .filter(q => q.gte(q.field("_creationTime"), oneDayAgo))
        .order("desc")
        .take(limit * 2), // Get more messages to ensure we have enough after filtering
      ctx.db.query("participants")
        .filter(q => q.gte(q.field("createdAt"), oneDayAgo))
        .order("desc")
        .take(limit),
    ]);

    // Get participant data for messages
    const participantIds = [...new Set(recentMessages.map(msg => msg.participantId))];
    const participants = await Promise.all(
      participantIds.map(id => ctx.db.get(id))
    );
    const participantMap = new Map(
      participants.filter(Boolean).map(p => [p!._id, p!])
    );

    const activities: Array<{
      type: "message" | "ai_interaction" | "new_participant";
      timestamp: number;
      description: string;
      details: {
        phone?: string;
        name?: string;
        preview?: string;
      };
    }> = [];

    // Add message activities
    recentMessages.forEach(msg => {
      const participant = participantMap.get(msg.participantId);
      const isAI = msg.aiMetadata !== undefined;
      
      activities.push({
        type: isAI ? "ai_interaction" : "message",
        timestamp: msg._creationTime,
        description: isAI 
          ? `AI responded to ${participant?.name || "Unknown"}`
          : `New message from ${participant?.name || "Unknown"}`,
        details: {
          phone: participant?.phone,
          name: participant?.name,
          preview: msg.body.length > 50 
            ? msg.body.substring(0, 50) + "..."
            : msg.body,
        },
      });
    });

    // Add new participant activities
    recentParticipants.forEach(participant => {
      activities.push({
        type: "new_participant",
        timestamp: participant.createdAt,
        description: `New participant joined: ${participant.name || "Unknown"}`,
        details: {
          phone: participant.phone,
          name: participant.name,
        },
      });
    });

    // Sort by timestamp and limit results
    return activities
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  },
});