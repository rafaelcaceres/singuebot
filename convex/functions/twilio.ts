"use node";

import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { internal, api } from "../_generated/api";
import {
  TWILIO_CONFIG,
  twilioAuthHeader,
  postTemplateMessage,
  statusCallbackUrl,
  withWhatsAppPrefix,
} from "../lib/twilioClient";
import { deriveContentKey, extractBodyTokens } from "./templateVariables";

/**
 * Fetch one template's details from the Twilio Content API.
 *
 * Previously this declared a `returns` validator requiring `types.twilio_text`, but
 * Twilio's actual JSON key is "twilio/text" (with a slash), so the validator could
 * never be satisfied — the action had never successfully returned. Returns are now
 * `v.any()` and the caller maps the payload (see functions/templateSync.ts).
 * Internal-only: it is a raw passthrough of an authenticated third-party API.
 */
export const fetchTemplateDetails = internalAction({
  args: {
    contentSid: v.string(),
  },
  returns: v.any(),
  handler: async (_ctx, args) => {
    const response = await fetch(
      `https://content.twilio.com/v1/Content/${args.contentSid}`,
      {
        method: "GET",
        headers: { Authorization: twilioAuthHeader() },
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Erro ao buscar template ${args.contentSid} no Twilio: ${response.status} ${body}`,
      );
    }

    return await response.json();
  },
});

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
      console.log("📱 Twilio: Message body:", args.body);

      // Check if this is an audio message and transcribe if needed
      let processedBody = args.body;
      let audioTranscription = undefined;
      
      if (args.mediaUrl && args.mediaContentType) {
        const { isAudioMessage } = await import("./audioTranscription");
        
        if (isAudioMessage(args.mediaContentType)) {
          console.log("🎵 Twilio: Audio message detected, starting transcription...");
          
          try {
             const transcriptionResult = await ctx.runAction(internal.functions.audioTranscription.transcribeAudio, {
               mediaUrl: args.mediaUrl,
               mediaContentType: args.mediaContentType,
               twilioAccountSid: TWILIO_CONFIG.accountSid!,
               twilioAuthToken: TWILIO_CONFIG.authToken!,
             });
             
             if (transcriptionResult.success && transcriptionResult.transcription) {
               processedBody = transcriptionResult.transcription;
               audioTranscription = {
                 originalMediaUrl: args.mediaUrl,
                 transcribedText: transcriptionResult.transcription,
                 processingTimeMs: transcriptionResult.processingTimeMs,
                 success: true,
                 audioMetadata: transcriptionResult.audioMetadata,
               };
               console.log("✅ Twilio: Audio transcribed successfully");
             } else {
               audioTranscription = {
                 originalMediaUrl: args.mediaUrl,
                 transcribedText: "",
                 processingTimeMs: transcriptionResult.processingTimeMs,
                 success: false,
                 error: transcriptionResult.error || "Transcription failed",
               };
               console.log("❌ Twilio: Audio transcription failed:", transcriptionResult.error);
             }
          } catch (error) {
            console.error("❌ Twilio: Error during audio transcription:", error);
            audioTranscription = {
              originalMediaUrl: args.mediaUrl,
              transcribedText: "",
              processingTimeMs: 0,
              success: false,
              error: error instanceof Error ? error.message : String(error),
            };
          }
        }
      }

      // Store the message with transcription data if available
      await ctx.runMutation(api.whatsapp.storeInboundMessage, {
        messageId: args.messageId,
        from: args.from,
        to: args.to,
        body: processedBody, // Use transcribed text if available
        messageType: audioTranscription ? "audio" : "text",
        mediaUrl: args.mediaUrl,
        mediaContentType: args.mediaContentType,
        twilioData: args.twilioData,
        audioTranscription,
      });

      // Get or create participant
      const participant = await ctx.runMutation(internal.functions.twilio_db.getOrCreateParticipant, {
        phone: args.from,
      });

      if (!participant) {
        console.error("❌ Twilio: Failed to get or create participant for", args.from);
        return;
      }

      // Operator took over this conversation: the message is already stored for the
      // console, so the bot stays silent (no consent prompt, no AI reply).
      const operatorMode: boolean = await ctx.runQuery(internal.operatorDashboard.isOperatorMode, {
        participantId: participant._id,
      });
      if (operatorMode) {
        console.log("🙋 Twilio: Operator mode active, skipping bot reply for", args.from);
        return;
      }

      // Check bot config for consent requirement
      const botConfig = await ctx.runQuery(internal.functions.botConfig.getActiveBotConfig);
      const consentRequired = botConfig?.config?.consentRequired ?? true;

      if (consentRequired) {
        // Check if participant has given consent
        if (!participant.consent && !isConsentMessage(args.body)) {
          const consentMessage = botConfig?.config?.consentMessage ||
            "Olá! Para começarmos nossa conversa, preciso do seu consentimento para coletar e processar seus dados. Você concorda? Responda SIM para continuar.";
          await ctx.runAction(api.functions.twilio.sendMessage, {
            to: args.from,
            body: consentMessage,
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
      }



      // Check 24h window for session vs HSM template logic  
      const window = await checkMessageWindow(args.from);
      console.log(`📱 Twilio: Message window for ${args.from}: ${window.window}`);

      // Process message using the modern AI system (works for both within and outside 24h window)
      await ctx.runAction(internal.agents.processIncomingMessage, {
        messageId: args.messageId,
        from: args.from,
        to: TWILIO_CONFIG.fromNumber || "",
        body: processedBody, // Use transcribed text if available
      });

      // Log analytics event
      await ctx.runMutation(internal.functions.twilio_db.logAnalyticsEvent, {
        type: window.mustUseHSM ? "message_outside_window" : "message_within_window",
        refId: participant._id,
        meta: {
          messageLength: args.body.length,
          processingType: "agents_system",
          windowType: window.window,
        },
      });

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
      messageType: "text", // Default message type
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

    // Build ContentVariables keyed the way Twilio actually matches them: by the
    // literal token in the template body, not by our app-side variable name.
    const bodyTokens: string[] = extractBodyTokens(template.twilioStructure?.body);
    const contentVariables: Record<string, string> = {};

    if (template.variableMappings?.length) {
      template.variableMappings.forEach((mapping: any, index: number) => {
        const value = args.variables?.[mapping.templateVariable];
        if (value === undefined) return;
        const key =
          mapping.contentKey ??
          deriveContentKey(mapping.templateVariable, [], bodyTokens, index);
        contentVariables[key] = String(value);
      });
    } else if (Array.isArray(template.variables)) {
      template.variables.forEach((variableName: string, index: number) => {
        const value = args.variables?.[variableName];
        if (value === undefined) return;
        contentVariables[deriveContentKey(variableName, [], bodyTokens, index)] =
          String(value);
      });
    }

    const twilioResponse = await postTemplateMessage({
      to: args.to,
      contentSid: template.twilioId,
      contentVariables,
      statusCallback: statusCallbackUrl(),
    });

    // Store outbound message
    await ctx.runMutation(api.whatsapp.storeOutboundMessage, {
      messageId: twilioResponse.sid,
      from: TWILIO_CONFIG.fromNumber ?? "",
      to: withWhatsAppPrefix(args.to),
      body: `[HSM Template: ${args.templateName}]`,
      messageType: "template", // Template message type
      twilioData: twilioResponse,
    });

    return twilioResponse;
  },
});

/**
 * Bulk template sending lives in functions/broadcasts.ts + functions/broadcastSender.ts.
 * The former `sendTemplateToMultipleParticipants` action was removed: its `variables`
 * argument validator was a closed object of {nome, email, cargo}, so any template
 * declaring another variable threw ArgumentValidationError before the handler ran,
 * and it looped synchronously with no throttle, progress, or resumability.
 */

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
      // Process the follow-up message using the modern AI system
      await ctx.runAction(internal.agents.processIncomingMessage, {
        messageId: args.originalMessageId,
        from: participant.phone,
        to: TWILIO_CONFIG.fromNumber || "",
        body: args.originalMessage,
      });

      // Log analytics event
      await ctx.runMutation(internal.functions.twilio_db.logAnalyticsEvent, {
        type: "follow_up_message",
        refId: args.participantId,
        meta: {
          messageLength: args.originalMessage.length,
          processingType: "agents_system",
        },
      });
    }
  },
});

// Helper functions
function isConsentMessage(body: string): boolean {
  const lowerBody = body.toLowerCase().trim();
  const consentWords = ["sim", "aceito", "concordo", "ok", "yes", "agree"];
  return consentWords.some((word: any) => lowerBody.includes(word));
}

async function checkMessageWindow(phoneNumber: string): Promise<{
  window: "within_24h" | "outside_24h";
  canSendSession: boolean;
  mustUseHSM: boolean;
}> {
  // Simple implementation - in production, this would check last message timestamp
  // For now, assume within window (can be enhanced with proper tracking)
  console.log("📱 Twilio: Checking message window for", phoneNumber);
  
  return {
    window: "within_24h",
    canSendSession: true,
    mustUseHSM: false,
  };
}
