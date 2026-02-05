import { v } from "convex/values";
import { Id } from "../_generated/dataModel";

// Channel adapter interface for different communication platforms
export interface ChannelAdapter {
  // Channel identification
  readonly type: ChannelType;
  readonly name: string;
  
  // Message handling
  processInboundMessage(payload: any): Promise<InboundMessage>;
  sendOutboundMessage(message: OutboundMessage): Promise<SendResult>;
  
  // Webhook handling
  validateWebhook(payload: any, signature?: string): boolean;
  parseWebhookEvent(payload: any): WebhookEvent;
  
  // Channel-specific operations
  getContactInfo(externalId: string): Promise<ContactInfo | null>;
  updateMessageStatus(externalId: string, status: MessageStatus): Promise<void>;
}

// Channel types
export type ChannelType = "whatsapp" | "telegram" | "web" | "api";

// Message status enum
export type MessageStatus = "received" | "processing" | "sent" | "delivered" | "read" | "failed";

// Message direction
export type MessageDirection = "inbound" | "outbound";

// Inbound message structure (normalized from channel-specific format)
export interface InboundMessage {
  externalId: string; // Channel-specific message ID
  contactExternalId: string; // Channel-specific contact ID (phone, user ID, etc.)
  content: {
    text?: string;
    mediaUrl?: string;
    mediaType?: string;
    metadata?: any;
  };
  timestamp: number;
  rawData: any; // Original channel payload
}

// Outbound message structure (to be sent to channel)
export interface OutboundMessage {
  contactExternalId: string; // Channel-specific contact ID
  content: {
    text?: string;
    mediaUrl?: string;
    mediaType?: string;
    metadata?: any;
  };
  metadata?: {
    conversationId: Id<"genericConversations">;
    botId: Id<"bots">;
    tenantId: Id<"tenants">;
  };
}

// Send result
export interface SendResult {
  success: boolean;
  externalId?: string; // Channel-specific message ID if successful
  error?: string;
  rawResponse?: any;
}

// Contact information
export interface ContactInfo {
  externalId: string;
  name?: string;
  metadata?: any;
}

// Webhook event types
export type WebhookEventType = "message" | "status_update" | "contact_update" | "other";

// Webhook event structure
export interface WebhookEvent {
  type: WebhookEventType;
  data: any;
  timestamp: number;
}

// Channel configuration validators
export const whatsappConfigValidator = v.object({
  twilioAccountSid: v.string(),
  twilioAuthToken: v.string(),
  twilioPhoneNumber: v.string(),
  webhookUrl: v.optional(v.string()),
});

export const telegramConfigValidator = v.object({
  telegramBotToken: v.string(),
  webhookUrl: v.optional(v.string()),
});

export const webConfigValidator = v.object({
  webOrigins: v.array(v.string()),
  apiKey: v.optional(v.string()),
});

export const apiConfigValidator = v.object({
  apiKey: v.string(),
  webhookUrl: v.optional(v.string()),
});

// Generic channel config validator
export const channelConfigValidator = v.union(
  whatsappConfigValidator,
  telegramConfigValidator,
  webConfigValidator,
  apiConfigValidator
);