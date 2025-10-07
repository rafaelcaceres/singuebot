import { v } from "convex/values";
import { query } from "./_generated/server";

// Real-time Analytics Functions for Enhanced Dashboard

export const getRealTimeMetrics = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = now - (30 * 24 * 60 * 60 * 1000);

    // Get all participants
    const allParticipants = await ctx.db.query("participants").collect();
    const totalParticipants = allParticipants.length;

    // Get all messages
    const allMessages = await ctx.db.query("whatsappMessages").collect();
    
    // Active participants (sent message in last 24h)
    const recentMessages = allMessages.filter(m => m._creationTime >= oneDayAgo);
    const activeParticipants24h = new Set(
      recentMessages.map(m => m.stateSnapshot?.twilioPayload?.From).filter(Boolean)
    ).size;

    // Message volume metrics
    const messagesLast24h = recentMessages.length;
    const messagesLastWeek = allMessages.filter(m => m._creationTime >= oneWeekAgo).length;
    const messagesLastMonth = allMessages.filter(m => m._creationTime >= oneMonthAgo).length;

    // Response rate calculation
    const inboundMessages = allMessages.filter(m => m.direction === "inbound");
    const outboundMessages = allMessages.filter(m => m.direction === "outbound");
    const responseRate = inboundMessages.length > 0 
      ? (outboundMessages.length / inboundMessages.length) * 100 
      : 0;

    // AI interactions - now from whatsappMessages with aiMetadata
    const messagesWithAI = await ctx.db
      .query("whatsappMessages")
      .filter(q => q.neq(q.field("aiMetadata"), undefined))
      .collect();
    
    const aiInteractions24h = messagesWithAI.filter(msg => 
      msg.aiMetadata && msg.aiMetadata.timestamp >= oneDayAgo
    ).length;

    // Consent metrics
    const participantsWithConsent = allParticipants.filter(p => p.consent === true).length;
    const consentRate = totalParticipants > 0 
      ? (participantsWithConsent / totalParticipants) * 100 
      : 0;

    // Interview sessions
    const interviewSessions = await ctx.db.query("interview_sessions").collect();
    const activeSessions = interviewSessions.filter(s => s.lastStepAt >= oneWeekAgo).length;

    // Knowledge base metrics
    const knowledgeDocs = await ctx.db.query("knowledge_docs").collect();
    const totalKnowledgeDocs = knowledgeDocs.length;
    const ingestedDocs = knowledgeDocs.filter(doc => doc.status === "ingested").length;

    return {
      participants: {
        total: totalParticipants,
        active24h: activeParticipants24h,
        withConsent: participantsWithConsent,
        consentRate: Math.round(consentRate * 100) / 100,
      },
      messages: {
        total: allMessages.length,
        last24h: messagesLast24h,
        lastWeek: messagesLastWeek,
        lastMonth: messagesLastMonth,
        responseRate: Math.round(responseRate * 100) / 100,
      },
      ai: {
        totalInteractions: messagesWithAI.length,
        interactions24h: aiInteractions24h,
        avgResponseTime: 1.2, // Placeholder - would calculate from actual data
      },
      interviews: {
        totalSessions: interviewSessions.length,
        activeSessions,
        completionRate: 0, // Will be calculated in getInterviewAnalytics
      },
      knowledge: {
        totalDocs: totalKnowledgeDocs,
        ingestedDocs,
        processingRate: totalKnowledgeDocs > 0 
          ? Math.round((ingestedDocs / totalKnowledgeDocs) * 100) 
          : 0,
      },
    };
  },
});

export const getMessageVolumeChart = query({
  args: {
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const days = args.days || 7;
    const now = Date.now();
    const startTime = now - (days * 24 * 60 * 60 * 1000);

    const messages = await ctx.db
      .query("whatsappMessages")
      .filter(q => q.gte(q.field("_creationTime"), startTime))
      .collect();

    // Group messages by day
    const messagesByDay = new Map<string, { inbound: number; outbound: number }>();
    
    for (let i = 0; i < days; i++) {
      const date = new Date(now - (i * 24 * 60 * 60 * 1000));
      const dateKey = date.toISOString().split('T')[0];
      messagesByDay.set(dateKey, { inbound: 0, outbound: 0 });
    }

    messages.forEach(message => {
      const date = new Date(message._creationTime);
      const dateKey = date.toISOString().split('T')[0];
      const dayData = messagesByDay.get(dateKey);
      
      if (dayData) {
        if (message.direction === "inbound") {
          dayData.inbound++;
        } else {
          dayData.outbound++;
        }
      }
    });

    return Array.from(messagesByDay.entries())
      .map(([date, data]) => ({
        date,
        inbound: data.inbound,
        outbound: data.outbound,
        total: data.inbound + data.outbound,
      }))
      .reverse(); // Most recent first
  },
});

export const getParticipantGrowthChart = query({
  args: {
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const days = args.days || 30;
    const now = Date.now();
    const startTime = now - (days * 24 * 60 * 60 * 1000);

    const participants = await ctx.db
      .query("participants")
      .filter(q => q.gte(q.field("_creationTime"), startTime))
      .collect();

    // Group participants by day
    const participantsByDay = new Map<string, number>();
    
    for (let i = 0; i < days; i++) {
      const date = new Date(now - (i * 24 * 60 * 60 * 1000));
      const dateKey = date.toISOString().split('T')[0];
      participantsByDay.set(dateKey, 0);
    }

    participants.forEach(participant => {
      const date = new Date(participant._creationTime);
      const dateKey = date.toISOString().split('T')[0];
      const count = participantsByDay.get(dateKey) || 0;
      participantsByDay.set(dateKey, count + 1);
    });

    // Calculate cumulative growth
    let cumulative = 0;
    return Array.from(participantsByDay.entries())
      .reverse() // Chronological order
      .map(([date, newParticipants]) => {
        cumulative += newParticipants;
        return {
          date,
          newParticipants,
          totalParticipants: cumulative,
        };
      });
  },
});

export const getInterviewAnalytics = query({
  args: {},
  handler: async (ctx) => {
    const sessions = await ctx.db.query("interview_sessions").collect();
    
    // Stage distribution
    const stageDistribution = sessions.reduce((acc, session) => {
      acc[session.step] = (acc[session.step] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Completion funnel
    const stages = ["intro", "termos_confirmacao", "momento_carreira", "expectativas_evento", "objetivo_principal", "finalizacao"];
    const funnel = stages.map(stage => ({
      stage,
      count: stageDistribution[stage] || 0,
      percentage: sessions.length > 0 
        ? Math.round(((stageDistribution[stage] || 0) / sessions.length) * 100)
        : 0,
    }));

    // Completion rate
    const completedSessions = sessions.filter(s => s.step === "finalizacao").length;
    const completionRate = sessions.length > 0 
      ? Math.round((completedSessions / sessions.length) * 100)
      : 0;

    // Average time between stages (simplified calculation)
    const avgStageTime = 2.5; // Days - placeholder

    return {
      totalSessions: sessions.length,
      completedSessions,
      completionRate,
      stageDistribution,
      funnel,
      avgStageTime,
    };
  },
});

export const getSystemHealth = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);

    // Recent activity indicators
    const recentMessages = await ctx.db
      .query("whatsappMessages")
      .filter(q => q.gte(q.field("_creationTime"), oneHourAgo))
      .collect();

    const recentAIInteractions = await ctx.db
      .query("whatsappMessages")
      .filter(q => q.gte(q.field("_creationTime"), oneHourAgo))
      .filter(q => q.neq(q.field("aiMetadata"), undefined))
      .collect();

    // Processing jobs status
    const processingJobs = await ctx.db
      .query("knowledge_docs")
      .withIndex("by_status", q => q.eq("status", "pending"))
      .collect();

    // System status indicators
    const messageProcessingHealth = recentMessages.length > 0 ? "healthy" : "idle";
    const aiProcessingHealth = recentAIInteractions.length > 0 ? "healthy" : "idle";
    const knowledgeProcessingHealth = processingJobs.length === 0 ? "healthy" : "processing";

    return {
      overall: "healthy", // Would be calculated based on all subsystems
      subsystems: {
        messageProcessing: {
          status: messageProcessingHealth,
          lastActivity: recentMessages[0]?._creationTime || null,
          throughput: recentMessages.length,
        },
        aiProcessing: {
          status: aiProcessingHealth,
          lastActivity: recentAIInteractions[0]?._creationTime || null,
          throughput: recentAIInteractions.length,
        },
        knowledgeProcessing: {
          status: knowledgeProcessingHealth,
          pendingJobs: processingJobs.length,
          lastProcessed: null, // Would track last successful processing
        },
      },
      uptime: "99.9%", // Placeholder - would be calculated from actual monitoring
      lastUpdated: now,
    };
  },
});

export const getTopParticipants = query({
  args: {
    limit: v.optional(v.number()),
    metric: v.optional(v.union(v.literal("messages"), v.literal("engagement"))),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;
    const metric = args.metric || "messages";

    const participants = await ctx.db.query("participants").collect();
    const allMessages = await ctx.db.query("whatsappMessages").collect();

    // Calculate metrics for each participant
    const participantMetrics = await Promise.all(
      participants.map(async (participant) => {
        const participantMessages = allMessages.filter(
          m => m.stateSnapshot?.twilioPayload?.From === participant.phone || 
               m.stateSnapshot?.twilioPayload?.To === participant.phone
        );
        
        const messageCount = participantMessages.length;
        const lastMessageTime = Math.max(
          ...participantMessages.map(m => m._creationTime),
          participant._creationTime
        );

        // Get cluster info
        const cluster = participant.clusterId 
          ? await ctx.db.get(participant.clusterId)
          : null;

        return {
          participant: {
            id: participant._id,
            name: participant.name,
            phone: participant.phone,
            cluster: cluster?.name || "No Cluster",
            consent: participant.consent,
          },
          metrics: {
            messageCount,
            lastActivity: lastMessageTime,
            engagementScore: messageCount * (participant.consent ? 1.5 : 1), // Boost for consent
          },
        };
      })
    );

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

export const getRecentActivity = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);

    // Get recent messages
    const recentMessages = await ctx.db
      .query("whatsappMessages")
      .filter(q => q.gte(q.field("_creationTime"), oneDayAgo))
      .order("desc")
      .take(limit);

    // Get recent AI interactions from whatsappMessages with aiMetadata
    const recentAI = await ctx.db
      .query("whatsappMessages")
      .filter(q => q.neq(q.field("aiMetadata"), undefined))
      .order("desc")
      .take(limit * 2); // Get more to filter by timestamp

    const filteredAI = recentAI
      .filter(msg => msg.aiMetadata && msg.aiMetadata.timestamp >= oneDayAgo)
      .slice(0, limit);

    // Get recent participants
    const recentParticipants = await ctx.db
      .query("participants")
      .filter(q => q.gte(q.field("_creationTime"), oneDayAgo))
      .order("desc")
      .take(limit);

    // Combine and format activities
    const activities = [
      ...recentMessages.map(msg => ({
        type: "message" as const,
        timestamp: msg._creationTime,
        description: `${msg.direction === "inbound" ? "Received" : "Sent"} message`,
        details: {
          phone: msg.stateSnapshot?.twilioPayload?.From,
          preview: msg.body.substring(0, 50) + (msg.body.length > 50 ? "..." : ""),
        },
      })),
      ...filteredAI.map(msg => ({
        type: "ai_interaction" as const,
        timestamp: msg.aiMetadata!.timestamp,
        description: "AI response generated",
        details: {
          phone: msg.stateSnapshot?.twilioPayload?.From,
          preview: msg.body.substring(0, 50) + (msg.body.length > 50 ? "..." : ""),
        },
      })),
      ...recentParticipants.map(participant => ({
        type: "new_participant" as const,
        timestamp: participant._creationTime,
        description: "New participant joined",
        details: {
          name: participant.name,
          phone: participant.phone,
        },
      })),
    ];

    // Sort by timestamp and limit
    return activities
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  },
});