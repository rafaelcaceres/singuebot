export interface TwilioWebhookPayload {
  MessageSid: string;
  From: string;
  To: string;
  Body: string;
  MediaUrl0?: string;
  MediaContentType0?: string;
  MessageStatus?: string;
  [key: string]: string | undefined;
}

export interface TwilioMessage {
  messageId: string;
  from: string;
  to: string;
  body: string;
  mediaUrl?: string;
  mediaContentType?: string;
  status: string;
  direction: "inbound" | "outbound";
  twilioData?: any;
}

export interface HSMTemplate {
  sid: string;
  friendlyName: string;
  language: string;
  status: "approved" | "pending" | "rejected";
  variables: string[];
}

export interface TwilioSendRequest {
  to: string;
  body: string;
  mediaUrl?: string;
}

export interface TwilioTemplateRequest {
  to: string;
  templateName: string;
  variables: Record<string, string>;
}

export interface TwilioResponse {
  sid: string;
  status: string;
  error_code?: string;
  error_message?: string;
}

export type MessageWindow = "within_24h" | "outside_24h";

export interface WindowDetectionResult {
  window: MessageWindow;
  canSendSession: boolean;
  mustUseHSM: boolean;
}