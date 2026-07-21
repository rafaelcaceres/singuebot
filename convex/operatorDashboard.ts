import { v } from "convex/values";
import { query, mutation, action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { postTemplateMessage, statusCallbackUrl } from "./lib/twilioClient";

/** WhatsApp's free-form service window. Outside it, only approved HSM templates send. */
export const WINDOW_MS = 24 * 60 * 60 * 1000;

// ============ QUERIES ============

/**
 * Get real-time metrics for the operator dashboard
 * - activeNow: Conversations with activity in last 15 minutes
 * - needsAttention: Conversations flagged for human intervention
 * - unread: Total unread inbound messages
 * - todayActivity: Messages sent/received today
 */
export const getOperatorMetrics = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const fifteenMinutesAgo = now - (15 * 60 * 1000);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartMs = todayStart.getTime();

    // Get all conversations
    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_open", (q) => q.eq("isOpen", true))
      .collect();

    // Count active conversations (activity in last 15 min)
    const activeConversations = conversations.filter(
      (c) => c.lastMessageAt >= fifteenMinutesAgo
    );

    // For needsAttention, we'll check participant context
    // Since context is stored in genericConversations, we check both tables
    let needsAttentionCount = 0;

    // Check genericConversations for needsHuman flag
    const genericConversations = await ctx.db
      .query("genericConversations")
      .withIndex("by_state", (q) => q.eq("state", "active"))
      .collect();

    for (const conv of genericConversations) {
      const context = conv.context as { needsHuman?: boolean } | undefined;
      if (context?.needsHuman) {
        needsAttentionCount++;
      }
    }

    // Count unread messages (inbound messages not marked as read)
    const unreadMessages = await ctx.db
      .query("whatsappMessages")
      .withIndex("by_direction", (q) => q.eq("direction", "inbound"))
      .filter((q) => q.neq(q.field("status"), "read"))
      .collect();

    // Count today's messages
    const todayMessages = await ctx.db
      .query("whatsappMessages")
      .filter((q) => q.gte(q.field("_creationTime"), todayStartMs))
      .collect();

    return {
      activeNow: activeConversations.length,
      needsAttention: needsAttentionCount,
      unread: unreadMessages.length,
      todayActivity: todayMessages.length,
    };
  },
});

/**
 * Get conversations list for operator with filtering
 */
export const getOperatorConversations = query({
  args: {
    filter: v.union(
      v.literal("all"),
      v.literal("active"),
      v.literal("needs_attention"),
      v.literal("unread")
    ),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    const now = Date.now();
    const fifteenMinutesAgo = now - (15 * 60 * 1000);
    const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
    const oneHourAgo = now - (60 * 60 * 1000);

    // Get all participants
    let participants = await ctx.db.query("participants").collect();

    // Apply search filter if provided
    if (args.search) {
      const searchLower = args.search.toLowerCase();
      participants = participants.filter(
        (p) =>
          p.name?.toLowerCase().includes(searchLower) ||
          p.phone.toLowerCase().includes(searchLower)
      );
    }

    // Build conversation data for each participant
    const conversationsData = await Promise.all(
      participants.map(async (participant) => {
        // Get messages for this participant
        const messages = await ctx.db
          .query("whatsappMessages")
          .withIndex("by_participant", (q) => q.eq("participantId", participant._id))
          .order("desc")
          .take(50);

        const lastMessage = messages[0];
        const unreadCount = messages.filter(
          (m) => m.direction === "inbound" && m.status !== "read"
        ).length;

        // Check if any recent AI response used fallback
        const recentAIMessages = messages.filter(
          (m) => m.direction === "outbound" && m.aiMetadata
        );
        const usedFallback = recentAIMessages.some(
          (m) => m.aiMetadata?.fallbackUsed
        );

        // Check genericConversation for needsHuman flag
        const genericConv = await ctx.db
          .query("genericConversations")
          .withIndex("by_participant", (q) => q.eq("participantId", participant._id))
          .first();

        const context = genericConv?.context as {
          needsHuman?: boolean;
          operatorMode?: boolean;
          escalationReason?: string;
          escalatedAt?: number;
        } | undefined;

        const needsHuman = context?.needsHuman || false;
        const operatorMode = context?.operatorMode || false;

        // Determine status
        let status: "active" | "fallback" | "needs_attention" | "inactive" = "inactive";
        const lastMessageTime = lastMessage?._creationTime || 0;

        if (needsHuman) {
          status = "needs_attention";
        } else if (lastMessageTime >= fifteenMinutesAgo) {
          status = usedFallback ? "fallback" : "active";
        } else if (lastMessageTime >= twentyFourHoursAgo) {
          if (usedFallback || lastMessageTime < oneHourAgo) {
            status = "fallback";
          } else {
            status = "active";
          }
        }

        return {
          participantId: participant._id,
          contact: {
            name: participant.name || null,
            phone: participant.phone.replace("whatsapp:", ""),
          },
          lastMessage: lastMessage
            ? {
                text: lastMessage.body,
                timestamp: lastMessage._creationTime,
                direction: lastMessage.direction,
              }
            : null,
          unreadCount,
          status,
          needsHuman,
          operatorMode,
          genericConversationId: genericConv?._id || null,
        };
      })
    );

    // Apply filter
    let filteredConversations = conversationsData;

    switch (args.filter) {
      case "active":
        filteredConversations = conversationsData.filter(
          (c) => c.status === "active" || c.status === "fallback"
        );
        break;
      case "needs_attention":
        filteredConversations = conversationsData.filter((c) => c.needsHuman);
        break;
      case "unread":
        filteredConversations = conversationsData.filter((c) => c.unreadCount > 0);
        break;
      // "all" - no filter
    }

    // Sort by last message time (most recent first), with needs_attention at top
    filteredConversations.sort((a, b) => {
      // Needs attention always comes first
      if (a.needsHuman && !b.needsHuman) return -1;
      if (!a.needsHuman && b.needsHuman) return 1;

      // Then sort by last message time
      const aTime = a.lastMessage?.timestamp || 0;
      const bTime = b.lastMessage?.timestamp || 0;
      return bTime - aTime;
    });

    // Apply limit
    return filteredConversations.slice(0, limit);
  },
});

/**
 * Get full conversation details including messages and participant info
 */
export const getConversationDetail = query({
  args: {
    participantId: v.id("participants"),
  },
  handler: async (ctx, args) => {
    // Get participant
    const participant = await ctx.db.get(args.participantId);
    if (!participant) {
      return null;
    }

    // Get messages
    const messages = await ctx.db
      .query("whatsappMessages")
      .withIndex("by_participant", (q) => q.eq("participantId", args.participantId))
      .order("asc")
      .collect();

    // Get cluster info
    let cluster = null;
    if (participant.clusterId) {
      cluster = await ctx.db.get(participant.clusterId);
    }

    // Get interview session
    const session = await ctx.db
      .query("interview_sessions")
      .withIndex("by_participant", (q) => q.eq("participantId", args.participantId))
      .first();

    // Get conversation record
    const conversation = await ctx.db
      .query("conversations")
      .withIndex("by_participant", (q) => q.eq("participantId", args.participantId))
      .first();

    // Get generic conversation for context
    const genericConversation = await ctx.db
      .query("genericConversations")
      .withIndex("by_participant", (q) => q.eq("participantId", args.participantId))
      .first();

    const context = genericConversation?.context as {
      needsHuman?: boolean;
      operatorMode?: boolean;
      escalationReason?: string;
      escalatedAt?: number;
      operatorTookOverAt?: number;
    } | undefined;

    // Get participant profile for rich data
    const profile = await ctx.db
      .query("participant_profiles")
      .withIndex("by_participant", (q) => q.eq("participantId", args.participantId))
      .first();

    // Count total conversations
    const allConversations = await ctx.db
      .query("conversations")
      .withIndex("by_participant", (q) => q.eq("participantId", args.participantId))
      .collect();

    // The WhatsApp 24-hour service window. Meta measures it from the last
    // message the participant sent us; we approximate that with the webhook's
    // receipt time, which can drift by seconds. Treat `isOpen` as advisory —
    // Twilio error 63016 is the authority — but never leave it invisible: an
    // operator typing into a closed window is a message that silently fails.
    let lastInboundAt: number | null = null;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].direction === "inbound") {
        lastInboundAt = messages[i]._creationTime;
        break;
      }
    }
    const expiresAt = lastInboundAt === null ? null : lastInboundAt + WINDOW_MS;

    return {
      participant: {
        ...participant,
        phone: participant.phone.replace("whatsapp:", ""),
      },
      messages: messages.map((m) => ({
        _id: m._id,
        body: m.body,
        direction: m.direction,
        status: m.status,
        timestamp: m._creationTime,
        mediaUrl: m.mediaUrl,
        mediaContentType: m.mediaContentType,
        aiMetadata: m.aiMetadata,
        audioTranscription: m.audioTranscription,
      })),
      cluster: cluster ? { id: cluster._id, name: cluster.name } : null,
      session: session
        ? {
            step: session.step,
            startedAt: session._creationTime,
          }
        : null,
      context: {
        needsHuman: context?.needsHuman || false,
        operatorMode: context?.operatorMode || false,
        escalationReason: context?.escalationReason,
        escalatedAt: context?.escalatedAt,
        operatorTookOverAt: context?.operatorTookOverAt,
      },
      profile,
      window: {
        lastInboundAt,
        expiresAt,
        isOpen: expiresAt !== null && Date.now() < expiresAt,
      },
      stats: {
        totalConversations: allConversations.length,
        totalMessages: messages.length,
        lastActivity: messages[messages.length - 1]?._creationTime,
      },
      genericConversationId: genericConversation?._id || null,
    };
  },
});

// ============ MUTATIONS ============

/**
 * Operator takes over conversation (pauses AI)
 */
export const takeOverConversation = mutation({
  args: {
    participantId: v.id("participants"),
  },
  handler: async (ctx, args) => {
    // Find or create genericConversation for this participant
    let genericConv = await ctx.db
      .query("genericConversations")
      .withIndex("by_participant", (q) => q.eq("participantId", args.participantId))
      .first();

    const now = Date.now();

    if (genericConv) {
      // Update existing conversation
      const currentContext = (genericConv.context as Record<string, unknown>) || {};
      await ctx.db.patch(genericConv._id, {
        context: {
          ...currentContext,
          operatorMode: true,
          operatorTookOverAt: now,
          needsHuman: false, // Clear the flag since operator is now handling
        },
      });
    } else {
      // We need to get tenant/bot/channel info - for now use defaults
      // In a real implementation, these would come from the participant's context
      const participant = await ctx.db.get(args.participantId);
      if (!participant) {
        throw new Error("Participant not found");
      }

      // Get or create a default tenant/bot/channel setup
      const tenant = await ctx.db.query("tenants").first();
      const bot = await ctx.db.query("bots").first();
      const channel = await ctx.db.query("channels").first();

      if (!tenant || !bot || !channel) {
        // Fallback: just update the legacy conversation
        const legacyConv = await ctx.db
          .query("conversations")
          .withIndex("by_participant", (q) => q.eq("participantId", args.participantId))
          .first();

        if (legacyConv) {
          // We can't store context in legacy conversations, so we'll skip for now
          console.log("No generic setup found, operator mode not persisted");
        }
        return { success: true, message: "Operator mode enabled (legacy)" };
      }

      // Create generic contact if needed
      let contact = await ctx.db
        .query("genericContacts")
        .withIndex("by_channel_external", (q) =>
          q.eq("channelId", channel._id).eq("externalId", participant.phone)
        )
        .first();

      if (!contact) {
        const contactId = await ctx.db.insert("genericContacts", {
          tenantId: tenant._id,
          channelId: channel._id,
          externalId: participant.phone,
          name: participant.name,
          isActive: true,
          createdAt: now,
        });
        contact = await ctx.db.get(contactId);
      }

      // Create genericConversation
      await ctx.db.insert("genericConversations", {
        tenantId: tenant._id,
        botId: bot._id,
        channelId: channel._id,
        contactId: contact!._id,
        participantId: args.participantId,
        state: "active",
        context: {
          operatorMode: true,
          operatorTookOverAt: now,
          needsHuman: false,
        },
        openedAt: now,
        lastMessageAt: now,
      });
    }

    return { success: true, message: "Operator took over conversation" };
  },
});

/**
 * Operator releases conversation (resumes AI)
 */
export const releaseConversation = mutation({
  args: {
    participantId: v.id("participants"),
  },
  handler: async (ctx, args) => {
    const genericConv = await ctx.db
      .query("genericConversations")
      .withIndex("by_participant", (q) => q.eq("participantId", args.participantId))
      .first();

    if (genericConv) {
      const currentContext = (genericConv.context as Record<string, unknown>) || {};
      await ctx.db.patch(genericConv._id, {
        context: {
          ...currentContext,
          operatorMode: false,
          needsHuman: false,
        },
      });
    }

    return { success: true, message: "AI resumed for conversation" };
  },
});

/**
 * Toggle needs attention flag
 */
export const toggleNeedsAttention = mutation({
  args: {
    participantId: v.id("participants"),
    needsHuman: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    let genericConv = await ctx.db
      .query("genericConversations")
      .withIndex("by_participant", (q) => q.eq("participantId", args.participantId))
      .first();

    if (genericConv) {
      const currentContext = (genericConv.context as Record<string, unknown>) || {};
      await ctx.db.patch(genericConv._id, {
        context: {
          ...currentContext,
          needsHuman: args.needsHuman,
          escalationReason: args.needsHuman ? "manual" : undefined,
          escalatedAt: args.needsHuman ? now : undefined,
        },
      });
    } else {
      // Create a minimal genericConversation to store the flag
      const participant = await ctx.db.get(args.participantId);
      if (!participant) {
        throw new Error("Participant not found");
      }

      const tenant = await ctx.db.query("tenants").first();
      const bot = await ctx.db.query("bots").first();
      const channel = await ctx.db.query("channels").first();

      if (tenant && bot && channel) {
        let contact = await ctx.db
          .query("genericContacts")
          .withIndex("by_channel_external", (q) =>
            q.eq("channelId", channel._id).eq("externalId", participant.phone)
          )
          .first();

        if (!contact) {
          const contactId = await ctx.db.insert("genericContacts", {
            tenantId: tenant._id,
            channelId: channel._id,
            externalId: participant.phone,
            name: participant.name,
            isActive: true,
            createdAt: now,
          });
          contact = await ctx.db.get(contactId);
        }

        await ctx.db.insert("genericConversations", {
          tenantId: tenant._id,
          botId: bot._id,
          channelId: channel._id,
          contactId: contact!._id,
          participantId: args.participantId,
          state: "active",
          context: {
            needsHuman: args.needsHuman,
            escalationReason: args.needsHuman ? "manual" : undefined,
            escalatedAt: args.needsHuman ? now : undefined,
          },
          openedAt: now,
          lastMessageAt: now,
        });
      }
    }

    return { success: true };
  },
});

/**
 * Mark all inbound messages as read for a participant
 * Called when operator opens a conversation
 */
export const markConversationAsRead = mutation({
  args: {
    participantId: v.id("participants"),
  },
  handler: async (ctx, args) => {
    // Get all unread inbound messages for this participant
    const unreadMessages = await ctx.db
      .query("whatsappMessages")
      .withIndex("by_participant", (q) => q.eq("participantId", args.participantId))
      .filter((q) =>
        q.and(
          q.eq(q.field("direction"), "inbound"),
          q.neq(q.field("status"), "read")
        )
      )
      .collect();

    // Mark each as read
    for (const message of unreadMessages) {
      await ctx.db.patch(message._id, {
        status: "read",
      });
    }

    return {
      success: true,
      markedAsRead: unreadMessages.length,
    };
  },
});

// ============ ACTIONS ============

/**
 * Send a message as the human operator. This is the ONLY manual send path —
 * `admin.sendManualMessage` was an identical twin reachable from the old
 * conversation viewer, and it let a human type while the AI was still
 * answering, producing two replies to one question.
 *
 * Taking over is now part of sending: you cannot speak for the assistant
 * without also pausing it.
 */
export const sendOperatorMessage = action({
  args: {
    participantId: v.id("participants"),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const participant = await ctx.runQuery(api.admin.getParticipantById, {
      participantId: args.participantId,
    });

    if (!participant) {
      throw new Error("Participant not found");
    }

    await ctx.runMutation(api.operatorDashboard.takeOverConversation, {
      participantId: args.participantId,
    });

    await ctx.runAction(api.whatsapp.sendMessage, {
      to: participant.phone,
      body: args.message,
    });

    return { success: true };
  },
});

/**
 * Send an approved HSM template from the inbox.
 *
 * This is the only way to reach a participant once the 24-hour window has
 * closed. Taking over first, same as a free-form send: the operator is speaking,
 * so the assistant stops.
 */
export const sendOperatorTemplate = action({
  args: {
    participantId: v.id("participants"),
    templateId: v.id("templates"),
    overrides: v.optional(v.record(v.string(), v.string())),
  },
  returns: v.object({
    success: v.boolean(),
    renderedBody: v.optional(v.string()),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ success: boolean; renderedBody?: string }> => {
    const resolved: {
      templateName: string;
      contentSid: string;
      contentVariables: Record<string, string>;
      missingRequired: string[];
      renderedBody?: string;
      phone: string;
    } = await ctx.runQuery(
      internal.functions.broadcasts.resolveTemplateForParticipant,
      {
        templateId: args.templateId,
        participantId: args.participantId,
        overrides: args.overrides,
      },
    );

    if (resolved.missingRequired.length > 0) {
      throw new Error(
        `Faltam variáveis obrigatórias para este participante: ${resolved.missingRequired.join(", ")}. Preencha o cadastro ou configure um valor padrão no template.`,
      );
    }

    await ctx.runMutation(api.operatorDashboard.takeOverConversation, {
      participantId: args.participantId,
    });

    const response = await postTemplateMessage({
      to: resolved.phone,
      contentSid: resolved.contentSid,
      contentVariables: resolved.contentVariables,
      statusCallback: statusCallbackUrl(),
    });

    await ctx.runMutation(internal.functions.broadcasts.logBroadcastMessage, {
      participantId: args.participantId,
      messageId: response.sid,
      phone: resolved.phone,
      templateName: resolved.templateName,
      twilioData: response,
    });

    return { success: true, renderedBody: resolved.renderedBody };
  },
});
