import { httpRouter } from "convex/server";
import { httpAction } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { getChannelAdapter } from "../adapters/registry";
import { Id } from "../_generated/dataModel";

const genericRouter = httpRouter();

// Generic webhook endpoint for all channels
// Route: /channels/{tenantSlug}/{botName}/{channelType}/webhook
genericRouter.route({
  path: "/channels/:tenantSlug/:botName/:channelType/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const pathParts = url.pathname.split('/');
      const tenantSlug = pathParts[2];
      const botName = pathParts[3];
      const channelType = pathParts[4];

      console.log(`📨 Received webhook for tenant: ${tenantSlug}, bot: ${botName}, channel: ${channelType}`);

      // Get channel configuration
      const channel = await ctx.runQuery(internal.functions.channels.getChannelByPath, {
        tenantSlug,
        botName,
        channelType: channelType as "whatsapp" | "telegram" | "web" | "api"
      });

      if (!channel) {
        console.error(`❌ Channel not found: ${tenantSlug}/${botName}/${channelType}`);
        return new Response("Channel not found", { status: 404 });
      }

      if (!channel.isActive) {
        console.error(`❌ Channel is inactive: ${channel._id}`);
        return new Response("Channel inactive", { status: 403 });
      }

      // Get channel adapter
      const adapter = getChannelAdapter(channel);
      
      // Parse webhook payload
      const body = await request.text();
      let payload: any;
      
      // Try to parse as JSON first, then as form data
      try {
        payload = JSON.parse(body);
      } catch {
        const params = new URLSearchParams(body);
        payload = Object.fromEntries(params.entries());
      }

      // Validate webhook
      const signature = request.headers.get('X-Twilio-Signature') || 
                       request.headers.get('X-Telegram-Bot-Api-Secret-Token') ||
                       request.headers.get('Authorization');
      
      if (!adapter.validateWebhook(payload, signature || undefined)) {
        console.error(`❌ Invalid webhook signature for channel: ${channel._id}`);
        return new Response("Invalid signature", { status: 401 });
      }

      // Parse webhook event
      const webhookEvent = adapter.parseWebhookEvent(payload);
      
      // Process based on event type
      switch (webhookEvent.type) {
        case "message":
          await processInboundMessage(ctx, channel, adapter, payload);
          break;
          
        case "status_update":
          await processStatusUpdate(ctx, channel, adapter, payload);
          break;
          
        case "contact_update":
          console.log(`📞 Contact update for channel: ${channel._id}`);
          // TODO: Handle contact updates
          break;
          
        default:
          console.log(`ℹ️ Unhandled webhook event type: ${webhookEvent.type}`);
      }

      // Return appropriate response based on channel type
      return getWebhookResponse(channelType);
      
    } catch (error) {
      console.error("❌ Error processing generic webhook:", error);
      return new Response("Error processing webhook", { status: 500 });
    }
  }),
});

// Generic message sending endpoint
// Route: /channels/{tenantSlug}/{botName}/{channelType}/send
genericRouter.route({
  path: "/channels/:tenantSlug/:botName/:channelType/send",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const pathParts = url.pathname.split('/');
      const tenantSlug = pathParts[2];
      const botName = pathParts[3];
      const channelType = pathParts[4];

      // Get channel configuration
      const channel = await ctx.runQuery(internal.functions.channels.getChannelByPath, {
        tenantSlug,
        botName,
        channelType: channelType as "whatsapp" | "telegram" | "web" | "api"
      });

      if (!channel || !channel.isActive) {
        return new Response("Channel not found or inactive", { status: 404 });
      }

      // Parse request body
      const requestData = await request.json();
      const { contactExternalId, content, conversationId } = requestData;

      if (!contactExternalId || !content) {
        return new Response("Missing required fields", { status: 400 });
      }

      // Send message via channel adapter
      const result = await ctx.runAction(internal.functions.messages.sendGenericMessage, {
        channelId: channel._id,
        contactExternalId,
        content,
        conversationId: conversationId as Id<"genericConversations"> | undefined
      });

      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 500,
        headers: { "Content-Type": "application/json" }
      });

    } catch (error) {
      console.error("❌ Error sending message:", error);
      return new Response("Error sending message", { status: 500 });
    }
  }),
});

// Helper function to process inbound messages
async function processInboundMessage(
  ctx: any,
  channel: any,
  adapter: any,
  payload: any
) {
  try {
    // Convert to normalized message format
    const inboundMessage = await adapter.processInboundMessage(payload);
    
    console.log(`📥 Processing inbound message: ${inboundMessage.externalId}`);
    
    // Process message through generic pipeline
    await ctx.scheduler.runAfter(0, internal.functions.messages.processInboundMessage, {
      channelId: channel._id,
      tenantId: channel.tenantId,
      botId: channel.botId,
      message: inboundMessage
    });
    
  } catch (error) {
    console.error("❌ Error processing inbound message:", error);
    throw error;
  }
}

// Helper function to process status updates
async function processStatusUpdate(
  ctx: any,
  channel: any,
  adapter: any,
  payload: any
) {
  try {
    // Extract message ID and status from payload
    const messageId = payload.MessageSid || payload.message_id || payload.id;
    const status = payload.MessageStatus || payload.status;
    
    if (messageId && status) {
      console.log(`📊 Status update for message ${messageId}: ${status}`);
      
      await ctx.runMutation(internal.functions.messages.updateGenericMessageStatus, {
        externalId: messageId,
        status: mapChannelStatusToGeneric(status, channel.type)
      });
    }
    
  } catch (error) {
    console.error("❌ Error processing status update:", error);
    throw error;
  }
}

// Helper function to map channel-specific status to generic status
function mapChannelStatusToGeneric(
  channelStatus: string,
  channelType: string
): "received" | "processing" | "sent" | "delivered" | "read" | "failed" {
  switch (channelType) {
    case "whatsapp": {
      switch (channelStatus) {
        case "queued":
        case "accepted":
          return "sent";
        case "undelivered":
          return "failed";
        case "delivered":
          return "delivered";
        case "read":
          return "read";
        default:
          return channelStatus as any;
      }
    }
      
    case "telegram":
      // TODO: Map Telegram statuses
      return channelStatus as any;
      
    default:
      return channelStatus as any;
  }
}

// Helper function to return appropriate webhook response
function getWebhookResponse(channelType: string): Response {
  switch (channelType) {
    case "whatsapp": {
      // Return TwiML response for WhatsApp/Twilio
      const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response></Response>`;
      return new Response(twimlResponse, {
        status: 200,
        headers: { "Content-Type": "text/xml" }
      });
    }
      
    case "telegram": {
      // Return JSON response for Telegram
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
      
    default:
      return new Response("OK", { status: 200 });
  }
}

export default genericRouter;