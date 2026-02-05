import { ChannelAdapter, ChannelType } from "../types/channels";
import { WhatsAppAdapter } from "./whatsapp";
import { Doc } from "../_generated/dataModel";

// Channel adapter registry
export class ChannelAdapterRegistry {
  private adapters: Map<string, ChannelAdapter> = new Map();
  
  // Register an adapter instance with a unique key
  register(key: string, adapter: ChannelAdapter): void {
    this.adapters.set(key, adapter);
  }
  
  // Get adapter by key
  get(key: string): ChannelAdapter | undefined {
    return this.adapters.get(key);
  }
  
  // Get adapter by channel configuration
  getByChannel(channel: Doc<"channels">): ChannelAdapter | undefined {
    const key = this.getChannelKey(channel);
    return this.adapters.get(key);
  }
  
  // Create and register adapter from channel configuration
  createFromChannel(channel: Doc<"channels">): ChannelAdapter {
    const key = this.getChannelKey(channel);
    
    // Check if adapter already exists
    const existing = this.adapters.get(key);
    if (existing) {
      return existing;
    }
    
    // Create new adapter based on channel type
    let adapter: ChannelAdapter;
    
    switch (channel.type) {
      case "whatsapp":
        adapter = new WhatsAppAdapter({
          twilioAccountSid: channel.config.twilioAccountSid!,
          twilioAuthToken: channel.config.twilioAuthToken!,
          twilioPhoneNumber: channel.config.twilioPhoneNumber!,
        });
        break;
        
      case "telegram":
        // TODO: Implement TelegramAdapter
        throw new Error("Telegram adapter not implemented yet");
        
      case "web":
        // TODO: Implement WebAdapter
        throw new Error("Web adapter not implemented yet");
        
      case "api":
        // TODO: Implement APIAdapter
        throw new Error("API adapter not implemented yet");
        
      default: {
        const exhaustiveCheck: never = channel.type;
        throw new Error(`Unsupported channel type: ${String(exhaustiveCheck)}`);
      }
    }
    
    // Register and return adapter
    this.register(key, adapter);
    return adapter;
  }
  
  // Generate unique key for channel
  private getChannelKey(channel: Doc<"channels">): string {
    return `${channel.tenantId}-${channel.botId}-${channel._id}`;
  }
  
  // Remove adapter from registry
  unregister(key: string): void {
    this.adapters.delete(key);
  }
  
  // Clear all adapters
  clear(): void {
    this.adapters.clear();
  }
  
  // Get all registered adapter keys
  getKeys(): string[] {
    return Array.from(this.adapters.keys());
  }
  
  // Get adapter count
  size(): number {
    return this.adapters.size;
  }
}

// Global registry instance
export const channelRegistry = new ChannelAdapterRegistry();

// Helper function to get or create adapter for a channel
export function getChannelAdapter(channel: Doc<"channels">): ChannelAdapter {
  return channelRegistry.createFromChannel(channel);
}