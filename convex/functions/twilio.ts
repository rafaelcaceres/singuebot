"use node";

import { v } from "convex/values";
import { action, httpAction, internalAction, internalMutation, internalQuery } from "../_generated/server";
import { internal, api } from "../_generated/api";

// Twilio Configuration
const TWILIO_CONFIG = {
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  fromNumber: process.env.TWILIO_WHATSAPP_NUMBER,
  webhookSecret: process.env.TWILIO_WEBHOOK_SECRET,
};

/**
 * Process inbound WhatsApp message (called from router.ts)
 */
export const processInboundMessage = internalAction({
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
    try {
      console.log("📱 Twilio: Processing inbound message from", args.from);

      // Store the message first
      await ctx.runMutation(api.whatsapp.storeIncomingMessage, {
        messageId: args.messageId,
        from: args.from,
        to: args.to,
        body: args.body,
        mediaUrl: args.mediaUrl,
        mediaContentType: args.mediaContentType,
        twilioData: args.twilioData,
      });

      // Get or create participant
      const participant = await ctx.runMutation(internal.functions.twilio_db.getOrCreateParticipant, {
        phone: args.from,
      });

      if (!participant) {
        console.error("❌ Twilio: Failed to get or create participant for", args.from);
        return;
      }

      // Check if participant has given consent
      if (!participant.consent && !isConsentMessage(args.body)) {
        // Send consent request
        await ctx.runAction(api.functions.twilio.sendMessage, {
          to: args.from,
          body: "👋 Olá! Para começarmos nossa conversa sobre sua jornada profissional, preciso do seu consentimento para coletar e processar seus dados. Você concorda? Responda SIM para continuar.",
        });
        return;
      }

      // Update consent if this is a consent message
      if (!participant.consent && isConsentMessage(args.body)) {
        await ctx.runMutation(internal.functions.twilio_db.updateParticipantConsent, {
          participantId: participant._id,
          consent: true,
        });
        console.log("✅ Twilio: Consent granted for", args.from);
      }

      // Check for opt-out messages
      if (isOptOutMessage(args.body)) {
        await ctx.runMutation(internal.functions.twilio_db.updateParticipantConsent, {
          participantId: participant._id,
          consent: false,
        });
        
        await ctx.runAction(api.functions.twilio.sendMessage, {
          to: args.from,
          body: "Entendido. Você foi removido de nossa lista e não receberá mais mensagens. Obrigado! 👋",
        });
        return;
      }

      // Check 24h window for session vs HSM template logic  
      const window = await checkMessageWindow(args.from);
      console.log(`📱 Twilio: Message window for ${args.from}: ${window.window}`);

      if (window.mustUseHSM) {
        // Outside 24h window - must use HSM template
        await handleOutsideWindowMessage(ctx, participant._id, args.body, args.messageId);
      } else {
        // Within 24h window - can send session messages
        await handleWithinWindowMessage(ctx, participant._id, args.body, args.messageId, args.from);
      }

    } catch (error) {
      console.error("📱 Twilio: Error processing inbound message:", error);
      
      // Send fallback message
      try {
        await ctx.runAction(api.functions.twilio.sendMessage, {
          to: args.from,
          body: "Desculpe, estou com dificuldades técnicas no momento. Tente novamente em alguns minutos. 🤖",
        });
      } catch (fallbackError) {
        console.error("📱 Twilio: Failed to send fallback message:", fallbackError);
      }
    }
  },
});

/**
 * Handle message within 24h window (can use session messages)
 */
async function handleWithinWindowMessage(
  ctx: any,
  participantId: string,
  body: string,
  messageId: string,
  phoneNumber: string
) {
  console.log("🕐 Twilio: Handling message within 24h window");

  // Process with interview system
  const interviewResponse = await ctx.runAction(internal.functions.interview.handleInbound, {
    participantId,
    text: body,
    messageId,
  });

  // Send interview response
  await ctx.runAction(api.functions.twilio.sendMessage, {
    to: phoneNumber,
    body: interviewResponse.response,
  });

  // Log analytics event
  await ctx.runMutation(internal.functions.twilio_db.logAnalyticsEvent, {
    type: "message_within_window",
    refId: participantId,
    meta: {
      stage: interviewResponse.nextStage,
      contextUsed: interviewResponse.contextUsed,
      messageLength: body.length,
    },
  });
}

/**
 * Handle message outside 24h window (must use HSM template)
 */
async function handleOutsideWindowMessage(
  ctx: any,
  participantId: string,
  body: string,
  messageId: string
) {
  console.log("🕛 Twilio: Handling message outside 24h window - using HSM");

  // Get participant session to determine appropriate template
  const session = await ctx.runQuery(api.functions.interview.getParticipantSession, {
    participantId,
  });

  const stage = session?.step || "intro";
  
  // Get appropriate HSM template for stage
  const template = await ctx.runQuery(internal.functions.twilio_db.getTemplateForStage, {
    stage,
    locale: "pt-BR",
  });

  if (template) {
    await ctx.runAction(api.functions.twilio.sendTemplate, {
      to: `whatsapp:${participantId}`, // This should be the phone number
      templateName: template.name,
      variables: {
        stage: stage,
        name: "participante", // Can be enhanced with actual name
      },
    });
  } else {
    console.warn(`📱 Twilio: No HSM template found for stage: ${stage}`);
    
    // Schedule a follow-up job to send when window reopens
    await ctx.scheduler.runAfter(24 * 60 * 60 * 1000, internal.functions.twilio.scheduleFollowUp, {
      participantId,
      originalMessage: body,
      originalMessageId: messageId,
    });
  }
}

/**
 * Send regular WhatsApp message (within 24h window)
 */
export const sendMessage = action({
  args: {
    to: v.string(),
    body: v.string(),
    mediaUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!TWILIO_CONFIG.accountSid || !TWILIO_CONFIG.authToken) {
      throw new Error("Twilio credentials not configured");
    }

    const fromNumber = TWILIO_CONFIG.fromNumber?.startsWith("whatsapp:") 
      ? TWILIO_CONFIG.fromNumber 
      : `whatsapp:${TWILIO_CONFIG.fromNumber}`;
    
    const toNumber = args.to.startsWith("whatsapp:") 
      ? args.to 
      : `whatsapp:${args.to}`;

    const messageData = new URLSearchParams({
      From: fromNumber,
      To: toNumber,
      Body: args.body,
    });

    if (args.mediaUrl) {
      messageData.append("MediaUrl", args.mediaUrl);
    }

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_CONFIG.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${TWILIO_CONFIG.accountSid}:${TWILIO_CONFIG.authToken}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: messageData.toString(),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send message: ${error}`);
    }

    const twilioResponse = await response.json();

    // Store outbound message
    await ctx.runMutation(api.whatsapp.storeOutboundMessage, {
      messageId: twilioResponse.sid,
      from: fromNumber,
      to: toNumber,
      body: args.body,
      status: twilioResponse.status,
      mediaUrl: args.mediaUrl,
      twilioData: twilioResponse,
    });

    return twilioResponse;
  },
});

/**
 * Send HSM template message (outside 24h window)
 */
export const sendTemplate = action({
  args: {
    to: v.string(),
    templateName: v.string(),
    variables: v.any(),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    if (!TWILIO_CONFIG.accountSid || !TWILIO_CONFIG.authToken) {
      throw new Error("Twilio credentials not configured");
    }

    // Get template details
    const template: any = await ctx.runQuery(internal.functions.twilio_db.getTemplateByName, {
      name: args.templateName,
    });

    if (!template) {
      throw new Error(`Template not found: ${args.templateName}`);
    }

    const fromNumber = TWILIO_CONFIG.fromNumber?.startsWith("whatsapp:") 
      ? TWILIO_CONFIG.fromNumber 
      : `whatsapp:${TWILIO_CONFIG.fromNumber}`;
    
    const toNumber = args.to.startsWith("whatsapp:") 
      ? args.to 
      : `whatsapp:${args.to}`;

    // Build template variables string
    const templateVariables = template.variables
      .map((varName: string) => args.variables[varName] || "")
      .join("|");

    const messageData: URLSearchParams = new URLSearchParams({
      From: fromNumber,
      To: toNumber,
      ContentSid: template.twilioId,
      ContentVariables: JSON.stringify(args.variables),
    });

    const response: Response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_CONFIG.accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${TWILIO_CONFIG.accountSid}:${TWILIO_CONFIG.authToken}`)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: messageData.toString(),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to send template: ${error}`);
    }

    const twilioResponse: any = await response.json();

    // Store outbound message
    await ctx.runMutation(api.whatsapp.storeOutboundMessage, {
      messageId: twilioResponse.sid,
      from: fromNumber,
      to: toNumber,
      body: `[HSM Template: ${args.templateName}]`,
      status: twilioResponse.status,
      twilioData: twilioResponse,
    });

    return twilioResponse;
  },
});

export const scheduleFollowUp = internalAction({
  args: {
    participantId: v.id("participants"),
    originalMessage: v.string(),
    originalMessageId: v.string(),
  },
  handler: async (ctx, args) => {
    console.log("⏰ Twilio: Scheduling follow-up for participant", args.participantId);
    
    // This would be called after 24h to process the delayed message
    const participant = await ctx.runQuery(internal.functions.twilio_db.getParticipant, { participantId: args.participantId });
    if (participant) {
      await handleWithinWindowMessage(
        ctx,
        args.participantId,
        args.originalMessage,
        args.originalMessageId,
        participant.phone
      );
    }
  },
});

// Helper functions
function isConsentMessage(body: string): boolean {
  const lowerBody = body.toLowerCase().trim();
  const consentWords = ["sim", "aceito", "concordo", "ok", "yes", "agree"];
  return consentWords.some(word => lowerBody.includes(word));
}

function isOptOutMessage(body: string): boolean {
  const lowerBody = body.toLowerCase().trim();
  const optOutWords = ["stop", "parar", "sair", "cancelar", "não quero", "nao quero"];
  return optOutWords.some(word => lowerBody.includes(word));
}

async function checkMessageWindow(phoneNumber: string): Promise<{
  window: "within_24h" | "outside_24h";
  canSendSession: boolean;
  mustUseHSM: boolean;
}> {
  // Simple implementation - in production, this would check last message timestamp
  // For now, assume within window (can be enhanced with proper tracking)
  
  return {
    window: "within_24h",
    canSendSession: true,
    mustUseHSM: false,
  };
}

// Webhook signature verification (for production)
function verifyTwilioSignature(signature: string, url: string, params: any): boolean {
  if (!TWILIO_CONFIG.webhookSecret) return true; // Skip verification if no secret
  
  // Implementation would verify X-Twilio-Signature header
  // Using crypto.createHmac('sha1', webhookSecret)
  return true; // Placeholder
}