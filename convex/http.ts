import { auth } from "./auth";
import router from "./router";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { getChannelAdapter } from "./adapters/registry";

const http = router;

// Add authentication routes
auth.addHttpRoutes(http);

// Generic webhook endpoint for all channels
http.route({
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
      
      try {
        payload = JSON.parse(body);
      } catch {
        // Try parsing as form data
        const formData = new URLSearchParams(body);
        payload = Object.fromEntries(formData.entries());
      }

      // Validate webhook signature if required
      if (adapter.validateWebhook) {
        const signature = request.headers.get('X-Twilio-Signature') || 
                         request.headers.get('X-Telegram-Bot-Api-Secret-Token') ||
                         request.headers.get('Authorization') || '';
        const isValid = adapter.validateWebhook(payload, signature);
        if (!isValid) {
          console.error(`❌ Invalid webhook signature for channel: ${channel._id}`);
          return new Response("Invalid signature", { status: 401 });
        }
      }

      // Parse webhook event
      const event = adapter.parseWebhookEvent(payload);
      
      if (event.type === "message") {
        await ctx.runAction(internal.functions.messages.processInboundMessage, {
          channelId: channel._id,
          tenantId: channel.tenantId,
          botId: channel.botId,
          message: event.data
        });
      } else if (event.type === "status_update") {
        await ctx.runMutation(internal.functions.messages.updateGenericMessageStatus, {
          externalId: event.data.messageId,
          status: event.data.status
        });
      }

      // Return appropriate response for the channel type
      return getWebhookResponse(channelType);

    } catch (error) {
      console.error("❌ Webhook processing error:", error);
      return new Response("Internal server error", { status: 500 });
    }
  })
});

// Generic message sending endpoint
http.route({
  path: "/channels/:tenantSlug/:botName/:channelType/send",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const pathParts = url.pathname.split('/');
      const tenantSlug = pathParts[2];
      const botName = pathParts[3];
      const channelType = pathParts[4];

      const body = await request.json();
      const { to, content, type = "text" } = body;

      if (!to || !content) {
        return new Response("Missing required fields: to, content", { status: 400 });
      }

      // Get channel configuration
      const channel = await ctx.runQuery(internal.functions.channels.getChannelByPath, {
        tenantSlug,
        botName,
        channelType: channelType as "whatsapp" | "telegram" | "web" | "api",
      });

      if (!channel) {
        return new Response("Channel not found", { status: 404 });
      }

      const result = await ctx.runAction(internal.functions.messages.sendGenericMessage, {
        channelId: channel._id,
        contactExternalId: to,
        content: {
          text: content,
        },
      });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });

    } catch (error) {
      console.error("❌ Message sending error:", error);
      return new Response("Internal server error", { status: 500 });
    }
  })
});

function getWebhookResponse(channelType: string): Response {
  switch (channelType) {
    case "whatsapp": {
      // WhatsApp expects TwiML response
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Message>Message received</Message>
        </Response>`;
      return new Response(twiml, {
        status: 200,
        headers: { "Content-Type": "application/xml" }
      });
    }
    case "telegram": {
      // Telegram expects JSON response
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    case "web":
    case "api":
    default: {
      return new Response(JSON.stringify({ status: "received" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
}

export default http;
