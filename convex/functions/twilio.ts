"use node";

import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { internal, api } from "../_generated/api";

// Twilio Configuration
const TWILIO_CONFIG = {
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  fromNumber: process.env.TWILIO_WHATSAPP_NUMBER,
  webhookSecret: process.env.TWILIO_WEBHOOK_SECRET,
};

/**
 * Fetch template details from Twilio Content API
 */
export const fetchTemplateDetails = action({
  args: {
    contentSid: v.string(),
  },
  returns: v.object({
    sid: v.string(),
    friendlyName: v.string(),
    language: v.string(),
    variables: v.array(v.object({
      key: v.string(),
      type: v.string(),
    })),
    types: v.object({
      twilio_text: v.object({
        body: v.string(),
      }),
    }),
  }),
  handler: async (ctx, args) => {
    try {
      console.log("🔍 Twilio: Fetching template details for", args.contentSid);

      const response = await fetch(
         `https://content.twilio.com/v1/Content/${args.contentSid}`,
         {
           method: "GET",
           headers: {
             Authorization: `Basic ${Buffer.from(
               `${TWILIO_CONFIG.accountSid!}:${TWILIO_CONFIG.authToken!}`
             ).toString("base64")}`,
           },
         }
       );

      if (!response.ok) {
        throw new Error(`Twilio API error: ${response.status} ${response.statusText}`);
      }

      const templateData = await response.json();
      console.log("✅ Twilio: Template details fetched successfully");

      return {
        sid: templateData.sid,
        friendlyName: templateData.friendly_name,
        language: templateData.language,
        variables: templateData.variables || [],
        types: templateData.types,
      };
    } catch (error) {
      console.error("❌ Twilio: Failed to fetch template details:", error);
      throw new Error(`Failed to fetch template details: ${error instanceof Error ? error.message : String(error)}`);
    }
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

    const fromNumber = TWILIO_CONFIG.fromNumber?.startsWith("whatsapp:") 
      ? TWILIO_CONFIG.fromNumber 
      : `whatsapp:${TWILIO_CONFIG.fromNumber}`;
    
    const toNumber = args.to.startsWith("whatsapp:") 
      ? args.to 
      : `whatsapp:${args.to}`;

    // Convert named variables to positional variables for Twilio HSM
    const positionalVariables: Record<string, string> = {};
    
    // Use variable mappings from template configuration if available
    if (template.variableMappings && Array.isArray(template.variableMappings)) {
      template.variableMappings.forEach((mapping: any) => {
        const value = args.variables[mapping.templateVariable];
        if (value !== undefined) {
          // Use the template variable as the key (should be numeric for Twilio)
          positionalVariables[mapping.templateVariable] = value;
        }
      });
    } else if (template.variables && Array.isArray(template.variables)) {
      // Fallback to original variables array for backward compatibility
      template.variables.forEach((variableName: string, index: number) => {
        const value = args.variables[variableName];
        if (value !== undefined) {
          // Twilio uses 1-based indexing for template variables
          positionalVariables[(index + 1).toString()] = value;
        }
      });
    }
    console.log("📱 Twilio: Sending template", args.templateName, "to", args.to, "with variables", args.variables);

    const messageData: URLSearchParams = new URLSearchParams({
      From: fromNumber,
      To: toNumber,
      ContentSid: template.twilioId,
      ContentVariables: JSON.stringify(positionalVariables),
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
      messageType: "template", // Template message type
      twilioData: twilioResponse,
    });

    return twilioResponse;
  },
});

/**
 * Send template to multiple participants
 */
export const sendTemplateToMultipleParticipants = action({
  args: {
    participantIds: v.array(v.id("participants")),
    templateName: v.string(),
    variables: v.optional(v.object({
      nome: v.optional(v.string()),
      email: v.optional(v.string()),
      cargo: v.optional(v.string()),
    })),
  },
  returns: v.object({
    success: v.array(v.object({
      participantId: v.id("participants"),
      phone: v.string(),
      messageId: v.string(),
    })),
    failed: v.array(v.object({
      participantId: v.id("participants"),
      phone: v.string(),
      error: v.string(),
    })),
    total: v.number(),
  }),
  handler: async (ctx, args) => {
    const results = {
      success: [] as Array<{participantId: any, phone: string, messageId: string}>,
      failed: [] as Array<{participantId: any, phone: string, error: string}>,
      total: args.participantIds.length,
    };

    // Get template configuration with variable mappings
    const templateConfig = await ctx.runQuery(api.functions.templateConfig.getTemplateConfigByName, {
      templateName: args.templateName,
    });

    if (!templateConfig) {
      // If template not found, mark all as failed
      for (const participantId of args.participantIds) {
        const participant = await ctx.runQuery(internal.functions.twilio_db.getParticipant, { participantId });
        results.failed.push({
          participantId,
          phone: participant?.phone || "unknown",
          error: `Template configuration not found: ${args.templateName}`,
        });
      }
      return results;
    }

    // Process each participant
    for (const participantId of args.participantIds) {
      try {
        // Get participant details
        const participant = await ctx.runQuery(internal.functions.twilio_db.getParticipant, { participantId });
        
        if (!participant) {
          results.failed.push({
            participantId,
            phone: "unknown",
            error: "Participant not found",
          });
          continue;
        }

        // Map participant data to template variables using stored mappings
        const participantVariables: Record<string, string> = {};
        
        console.log("🔍 Template config:", templateConfig);
        console.log("🔍 Participant data:", participant);
        
        // Use the stored variable mappings from template configuration
        if (templateConfig.variableMappings) {
          for (const mapping of templateConfig.variableMappings) {
            let value = "";
            
            // Get value from participant field
            if (mapping.participantField) {
              const fieldValue = participant[mapping.participantField as keyof typeof participant];
              value = fieldValue ? String(fieldValue) : "";
              console.log(`🔍 Mapping ${mapping.templateVariable} from ${mapping.participantField}: "${value}"`);
            }
            
            // Use manual override if provided
            if (args.variables && args.variables[mapping.templateVariable as keyof typeof args.variables]) {
              value = args.variables[mapping.templateVariable as keyof typeof args.variables] as string;
              console.log(`🔍 Manual override for ${mapping.templateVariable}: "${value}"`);
            }
            
            // Use default value if no value found and default is provided
            if (!value && mapping.defaultValue) {
              value = mapping.defaultValue;
              console.log(`🔍 Using default value for ${mapping.templateVariable}: "${value}"`);
            }
            
            // If required and still no value, use a fallback
            if (!value && mapping.isRequired) {
              value = mapping.participantField === "name" ? "Participante" : "";
              console.log(`🔍 Using fallback for required ${mapping.templateVariable}: "${value}"`);
            }
            
            participantVariables[mapping.templateVariable] = value;
          }
        }
        
        console.log("🔍 Final participant variables:", participantVariables);

        // Send template using existing sendTemplate function
        const twilioResponse = await ctx.runAction(api.functions.twilio.sendTemplate, {
          to: participant.phone,
          templateName: args.templateName,
          variables: participantVariables,
        });

        results.success.push({
          participantId,
          phone: participant.phone,
          messageId: twilioResponse.sid,
        });

      } catch (error) {
        const participant = await ctx.runQuery(internal.functions.twilio_db.getParticipant, { participantId });
        results.failed.push({
          participantId,
          phone: participant?.phone || "unknown",
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return results;
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
  return consentWords.some(word => lowerBody.includes(word));
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
