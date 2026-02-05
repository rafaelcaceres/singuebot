import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { Doc } from "../_generated/dataModel";

// Utility script to run migration with different configurations
export const runWhatsAppMigration = action({
  args: {
    tenantSlug: v.optional(v.string()),
    tenantName: v.optional(v.string()),
    botName: v.optional(v.string()),
    dryRun: v.optional(v.boolean()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    stats: v.object({
      participantsMigrated: v.number(),
      conversationsMigrated: v.number(),
      messagesMigrated: v.number(),
      errors: v.array(v.string()),
    }),
  }),
  handler: async (ctx, args) => {
    const config = {
      tenantSlug: args.tenantSlug || "singue",
      tenantName: args.tenantName || "Singuê",
      botName: args.botName || "WhatsApp Assistant",
      dryRun: args.dryRun ?? true, // Default to dry run for safety
    };

    console.log("🚀 Starting WhatsApp to Generic System Migration");
    console.log(`📋 Configuration:`, config);

    try {
      // For now, return a placeholder result since the migration function needs to be properly registered
      console.log("⚠️ Migration function not yet available - returning placeholder");
      
      return {
        success: true,
        message: "Migration script created but not yet executed",
        stats: {
          participantsMigrated: 0,
          conversationsMigrated: 0,
          messagesMigrated: 0,
          errors: [],
        },
      };

    } catch (error) {
      const errorMessage = `❌ Migration failed: ${String(error)}`;
      console.error(errorMessage);

      return {
        success: false,
        message: errorMessage,
        stats: {
          participantsMigrated: 0,
          conversationsMigrated: 0,
          messagesMigrated: 0,
          errors: [errorMessage],
        },
      };
    }
  },
});

// Preset configurations for different environments
export const runSingueMigration = action({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args): Promise<{ success: boolean; message: string }> => {
    return await ctx.runAction(internal.migrations.migrateToGenericSystem.migrateWhatsAppToGeneric, {
      tenantSlug: "singue",
      tenantName: "Singuê",
      botName: "Fabi - Assistente de Entrevistas",
      dryRun: args.dryRun ?? true,
    });
  },
});

export const runPactuaMigration = action({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx, args): Promise<{ success: boolean; message: string }> => {
    return await ctx.runAction(internal.migrations.migrateToGenericSystem.migrateWhatsAppToGeneric, {
      tenantSlug: "pactua",
      tenantName: "Pactuá",
      botName: "Assistente Pactuá",
      dryRun: args.dryRun ?? true,
    });
  },
});

// Validation function to check migration readiness
export const validateMigrationReadiness = action({
  args: {},
  returns: v.object({
    ready: v.boolean(),
    issues: v.array(v.string()),
    stats: v.object({
      participantsCount: v.number(),
      conversationsCount: v.number(),
      messagesCount: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    const issues: string[] = [];
    
    try {
      // Check if we have data to migrate
      const participants: Doc<"participants">[] = await ctx.runQuery(
        internal.migrations.migrateToGenericSystem.getAllParticipants,
        {}
      );
      
      const conversations: Doc<"conversations">[] = await ctx.runQuery(
        internal.migrations.migrateToGenericSystem.getAllConversations,
        {}
      );
      
      const messages: Doc<"whatsappMessages">[] = await ctx.runQuery(
        internal.migrations.migrateToGenericSystem.getAllWhatsAppMessages,
        {}
      );

      const stats = {
        participantsCount: participants.length,
        conversationsCount: conversations.length,
        messagesCount: messages.length,
      };

      // Validation checks
      if (participants.length === 0) {
        issues.push("No participants found to migrate");
      }

      if (conversations.length === 0) {
        issues.push("No conversations found to migrate");
      }

      if (messages.length === 0) {
        issues.push("No messages found to migrate");
      }

      // Check for orphaned data
      const orphanedConversations = conversations.filter((conv: Doc<"conversations">) => 
        !participants.some((p: Doc<"participants">) => p._id === conv.participantId)
      );
      
      if (orphanedConversations.length > 0) {
        issues.push(`Found ${orphanedConversations.length} conversations without matching participants`);
      }

      const orphanedMessages = messages.filter((msg: Doc<"whatsappMessages">) => 
        !conversations.some((c: Doc<"conversations">) => c._id === msg.conversationId)
      );
      
      if (orphanedMessages.length > 0) {
        issues.push(`Found ${orphanedMessages.length} messages without matching conversations`);
      }

      return {
        ready: issues.length === 0,
        issues,
        stats,
      };

    } catch (error) {
      return {
        ready: false,
        issues: [`Validation failed: ${String(error)}`],
        stats: {
          participantsCount: 0,
          conversationsCount: 0,
          messagesCount: 0,
        },
      };
    }
  },
});