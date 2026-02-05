import { 
  ChannelAdapter, 
  InboundMessage, 
  OutboundMessage, 
  SendResult, 
  ContactInfo, 
  WebhookEvent,
  MessageStatus 
} from "../types/channels";

export class WhatsAppAdapter implements ChannelAdapter {
  readonly type = "whatsapp" as const;
  readonly name = "WhatsApp";
  
  private twilioAccountSid: string;
  private twilioAuthToken: string;
  private twilioPhoneNumber: string;
  
  constructor(config: {
    twilioAccountSid: string;
    twilioAuthToken: string;
    twilioPhoneNumber: string;
  }) {
    this.twilioAccountSid = config.twilioAccountSid;
    this.twilioAuthToken = config.twilioAuthToken;
    this.twilioPhoneNumber = config.twilioPhoneNumber;
  }
  
  async processInboundMessage(payload: any): Promise<InboundMessage> {
    // Validate required Twilio fields
    if (!payload.MessageSid || !payload.From || !payload.To) {
      throw new Error("Invalid Twilio webhook payload: missing required fields");
    }
    
    // Extract media information if present
    const mediaUrl = payload.MediaUrl0;
    const mediaType = payload.MediaContentType0;
    
    return {
      externalId: payload.MessageSid,
      contactExternalId: payload.From, // WhatsApp phone number with whatsapp: prefix
      content: {
        text: payload.Body || undefined,
        mediaUrl: mediaUrl || undefined,
        mediaType: mediaType || undefined,
        metadata: {
          numMedia: payload.NumMedia ? parseInt(payload.NumMedia) : 0,
          profileName: payload.ProfileName,
          waId: payload.WaId,
        }
      },
      timestamp: Date.now(),
      rawData: payload
    };
  }
  
  async sendOutboundMessage(message: OutboundMessage): Promise<SendResult> {
    try {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.twilioAccountSid}/Messages.json`;
      
      // Prepare message body
      const body = new URLSearchParams();
      body.append('From', this.twilioPhoneNumber);
      body.append('To', message.contactExternalId);
      
      if (message.content.text) {
        body.append('Body', message.content.text);
      }
      
      if (message.content.mediaUrl) {
        body.append('MediaUrl', message.content.mediaUrl);
      }
      
      // Send message via Twilio API
      const response = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`${this.twilioAccountSid}:${this.twilioAuthToken}`)}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString()
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        return {
          success: false,
          error: result.message || 'Failed to send message',
          rawResponse: result
        };
      }
      
      return {
        success: true,
        externalId: result.sid,
        rawResponse: result
      };
      
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
  
  validateWebhook(payload: any, signature?: string): boolean {
    // For now, basic validation - in production, implement Twilio signature validation
    return !!(payload.MessageSid && payload.AccountSid && payload.From && payload.To);
  }
  
  parseWebhookEvent(payload: any): WebhookEvent {
    // Determine event type based on payload structure
    if (payload.MessageSid && payload.Body !== undefined) {
      return {
        type: "message",
        data: payload,
        timestamp: Date.now()
      };
    } else if (payload.MessageSid && payload.MessageStatus) {
      return {
        type: "status_update",
        data: payload,
        timestamp: Date.now()
      };
    } else {
      return {
        type: "other",
        data: payload,
        timestamp: Date.now()
      };
    }
  }
  
  async getContactInfo(externalId: string): Promise<ContactInfo | null> {
    // WhatsApp doesn't provide a direct API to get contact info
    // We can only work with what we receive in messages
    return {
      externalId,
      name: undefined, // Will be populated from ProfileName in messages
      metadata: {}
    };
  }
  
  async updateMessageStatus(externalId: string, status: MessageStatus): Promise<void> {
    // WhatsApp status updates come via webhooks, not API calls
    // This is a no-op for WhatsApp adapter
    console.log(`WhatsApp message ${externalId} status updated to ${status}`);
  }
  
  // Helper method to normalize phone numbers
  static normalizePhoneNumber(phone: string): string {
    // Remove whatsapp: prefix if present
    const cleanPhone = phone.replace(/^whatsapp:/, '');
    
    // Add whatsapp: prefix for consistency
    return `whatsapp:${cleanPhone}`;
  }
  
  // Helper method to extract phone number without prefix
  static extractPhoneNumber(phone: string): string {
    return phone.replace(/^whatsapp:/, '');
  }
}