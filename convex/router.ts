import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

const http = httpRouter();

// Webhook endpoint for incoming WhatsApp messages
http.route({
  path: "/whatsapp/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.text();
      const params = new URLSearchParams(body);

      const messageData = {
        messageId: params.get("MessageSid") || "",
        from: params.get("From") || "",
        to: params.get("To") || "",
        body: params.get("Body") || "",
        mediaUrl: params.get("MediaUrl0") || undefined,
        mediaContentType: params.get("MediaContentType0") || undefined,
        twilioData: Object.fromEntries(params.entries()),
      };

      // Process message with enhanced Twilio integration
      if (messageData.body && messageData.body.trim()) {
        console.log("📅 Processing inbound WhatsApp message:", messageData.messageId);

        // Use the new enhanced Twilio processing
        await ctx.scheduler.runAfter(0, internal.functions.twilio.processInboundMessage, {
          messageId: messageData.messageId,
          from: messageData.from,
          to: messageData.to,
          body: messageData.body,
          mediaUrl: messageData.mediaUrl,
          mediaContentType: messageData.mediaContentType,
          twilioData: messageData.twilioData,
        });
      }

      // Return TwiML response (acknowledge receipt)
      const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response></Response>`;

      return new Response(twimlResponse, {
        status: 200,
        headers: {
          "Content-Type": "text/xml",
        },
      });
    } catch (error) {
      console.error("Error processing WhatsApp webhook:", error);
      return new Response("Error processing webhook", { status: 500 });
    }
  }),
});

// Webhook endpoint for message status updates
http.route({
  path: "/whatsapp/status",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.text();
      const params = new URLSearchParams(body);
      
      const messageId = params.get("MessageSid");
      const status = params.get("MessageStatus");

      if (messageId && status) {
        // Map Twilio status to our expected values
        const mappedStatus = status === "queued" || status === "accepted" ? "sent" : 
                           status === "undelivered" ? "failed" : 
                           status as "received" | "processing" | "sent" | "delivered" | "read" | "failed";

        await ctx.runMutation(api.whatsapp.updateMessageStatus, {
          messageId,
          status: mappedStatus,
        });
      }

      return new Response("Status updated", { status: 200 });
    } catch (error) {
      console.error("Error processing status webhook:", error);
      return new Response("Error processing status webhook", { status: 500 });
    }
  }),
});

// API endpoint to send a message
http.route({
  path: "/whatsapp/send",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const { to, body, mediaUrl } = await request.json();

      if (!to || !body) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: to, body" }),
          { 
            status: 400,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      const result = await ctx.runAction(api.functions.twilio.sendMessage, {
        to,
        body,
        mediaUrl,
      });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error sending message:", error);
      return new Response(
        JSON.stringify({ error: "Failed to send message" }),
        { 
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  }),
});

// API endpoint to get messages for a phone number
http.route({
  path: "/whatsapp/messages",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const phoneNumber = url.searchParams.get("phoneNumber");
      const limit = parseInt(url.searchParams.get("limit") || "50");

      if (!phoneNumber) {
        return new Response(
          JSON.stringify({ error: "Missing phoneNumber parameter" }),
          { 
            status: 400,
            headers: { "Content-Type": "application/json" }
          }
        );
      }

      const messages = await ctx.runQuery(api.whatsapp.getMessages, {
        phoneNumber,
        limit,
      });

      return new Response(JSON.stringify(messages), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error fetching messages:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch messages" }),
        { 
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  }),
});

// API endpoint to get all contacts
http.route({
  path: "/whatsapp/contacts",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    console.log("Fetching contacts...", request.url);
    try {
      const contacts = await ctx.runQuery(api.whatsapp.getContacts);

      return new Response(JSON.stringify(contacts), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error fetching contacts:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch contacts" }),
        { 
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  }),
});

// API endpoint to get AI interactions
http.route({
  path: "/whatsapp/ai-interactions",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    try {
      const url = new URL(request.url);
      const phoneNumber = url.searchParams.get("phoneNumber");
      const limit = parseInt(url.searchParams.get("limit") || "50");

      const interactions = await ctx.runQuery(api.agents.getAIInteractions, {
        phoneNumber: phoneNumber || undefined,
        limit,
      });

      return new Response(JSON.stringify(interactions), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("Error fetching AI interactions:", error);
      return new Response(
        JSON.stringify({ error: "Failed to fetch AI interactions" }),
        { 
          status: 500,
          headers: { "Content-Type": "application/json" }
        }
      );
    }
  }),
});

export default http;
