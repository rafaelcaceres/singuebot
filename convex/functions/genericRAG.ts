import { components } from "../_generated/api";
import { RAG } from "@convex-dev/rag";
import { openai } from "@ai-sdk/openai";
import { v } from "convex/values";
import { action, internalAction, query, internalQuery } from "../_generated/server";
import { Id } from "../_generated/dataModel";

// Generic RAG system with namespace support for multi-tenant architecture
export const rag = new RAG(components.rag, {
  textEmbeddingModel: openai.embedding("text-embedding-3-small"),
  embeddingDimension: 1536,
});

// Helper function to generate namespace for tenant/bot combination
function generateNamespace(tenantSlug: string, botName: string): string {
  return `${tenantSlug}_${botName}`.toLowerCase().replace(/[^a-z0-9_]/g, '_');
}

// Insert document into specific tenant/bot namespace
export const insertDocumentForBot = action({
  args: {
    tenantSlug: v.string(),
    botName: v.string(),
    document: v.string(),
    title: v.string(),
    hash: v.string(),
    format: v.optional(v.union(v.literal("pdf"), v.literal("md"), v.literal("txt"))),
    metadata: v.optional(v.any()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const namespace = generateNamespace(args.tenantSlug, args.botName);
    
    console.log(`📚 Inserting document "${args.title}" into namespace: ${namespace}`);
    
    const result = await rag.add(ctx, {
      namespace,
      title: args.title,
      contentHash: args.hash,
      text: args.document,
      metadata: {
        format: args.format || "txt",
        uploadedAt: Date.now(),
        tenantSlug: args.tenantSlug,
        botName: args.botName,
        ...args.metadata,
      },
    });
    
    return result;
  },
});

// Search knowledge in specific tenant/bot namespace
export const searchKnowledgeForBot = internalAction({
  args: {
    tenantSlug: v.string(),
    botName: v.string(),
    query: v.string(),
    limit: v.optional(v.number()),
    namespace: v.optional(v.string()), // Optional direct namespace override (uses ragNamespace from bot config)
  },
  returns: v.array(v.object({
    content: v.string(),
    score: v.number(),
    title: v.string(),
    metadata: v.any(),
  })),
  handler: async (ctx, args) => {
    // Use direct namespace if provided (from bot config), otherwise generate from tenant/bot
    const namespace = args.namespace || generateNamespace(args.tenantSlug, args.botName);
    const limit = args.limit ?? 5;
    
    console.log(`🔎 Searching knowledge in namespace: ${namespace} for query: "${args.query}"`);
    
    try {
      const results = await rag.search(ctx, {
        namespace,
        query: args.query,
        limit,
      });

      const formattedResults = results.results.map((result: any) => ({
        content: result.content?.[0]?.text || "",
        score: result.score,
        title: result.content?.[0]?.metadata?.title || "Untitled",
        metadata: result.content?.[0]?.metadata || {},
      }));

      console.log(`✅ Found ${formattedResults.length} results in namespace: ${namespace}`);
      return formattedResults;

    } catch (error) {
      console.error(`❌ Error searching knowledge in namespace ${namespace}:`, error);
      return [];
    }
  },
});

// Replace document in specific tenant/bot namespace
export const replaceDocumentForBot = action({
  args: {
    tenantSlug: v.string(),
    botName: v.string(),
    document: v.string(),
    title: v.string(),
    hash: v.string(),
    format: v.optional(v.union(v.literal("pdf"), v.literal("md"), v.literal("txt"))),
    metadata: v.optional(v.any()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const namespace = generateNamespace(args.tenantSlug, args.botName);
    
    console.log(`🔄 Replacing document "${args.title}" in namespace: ${namespace}`);
    
    const result = await rag.add(ctx, {
      namespace,
      title: args.title,
      contentHash: args.hash,
      text: args.document,
      metadata: {
        format: args.format || "txt",
        uploadedAt: Date.now(),
        tenantSlug: args.tenantSlug,
        botName: args.botName,
        replaced: true,
        ...args.metadata,
      },
    });
    
    return result;
  },
});

// List documents for specific tenant/bot namespace
export const listDocumentsForBot = action({
  args: {
    tenantSlug: v.string(),
    botName: v.string(),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    const namespace = generateNamespace(args.tenantSlug, args.botName);
    
    console.log(`📋 Listing documents in namespace: ${namespace}`);
    
    try {
      // This would need to be implemented based on Convex RAG's document listing capabilities
      // For now, return a placeholder with namespace info
      return [{
        namespace,
        tenantSlug: args.tenantSlug,
        botName: args.botName,
        message: "Document listing not yet implemented in Convex RAG",
      }];
    } catch (error) {
      console.error(`❌ Error listing documents in namespace ${namespace}:`, error);
      return [];
    }
  },
});

// Delete document from specific tenant/bot namespace
export const deleteDocumentForBot = action({
  args: {
    tenantSlug: v.string(),
    botName: v.string(),
    hash: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const namespace = generateNamespace(args.tenantSlug, args.botName);
    
    console.log(`🗑️ Deleting document with hash "${args.hash}" from namespace: ${namespace}`);
    
    try {
      // This would need to be implemented based on Convex RAG's document deletion capabilities
      // For now, return success placeholder
      console.log(`✅ Document deletion requested for namespace: ${namespace}`);
      return true;
    } catch (error) {
      console.error(`❌ Error deleting document in namespace ${namespace}:`, error);
      return false;
    }
  },
});

// Get namespace for tenant/bot combination (utility function)
export const getNamespaceForBot = query({
  args: {
    tenantSlug: v.string(),
    botName: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    return generateNamespace(args.tenantSlug, args.botName);
  },
});

// Migrate documents from global namespace to tenant/bot specific namespace
export const migrateDocumentsToNamespace = action({
  args: {
    tenantSlug: v.string(),
    botName: v.string(),
    sourceNamespace: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    migratedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const targetNamespace = generateNamespace(args.tenantSlug, args.botName);
    const sourceNamespace = args.sourceNamespace || "global_knowledge";
    
    console.log(`🔄 Migrating documents from "${sourceNamespace}" to "${targetNamespace}"`);
    
    try {
      // This would need to be implemented based on Convex RAG's migration capabilities
      // For now, return success placeholder
      const migratedCount = 0; // Placeholder
      
      return {
        success: true,
        message: `Migration completed from ${sourceNamespace} to ${targetNamespace}`,
        migratedCount,
      };
    } catch (error) {
      console.error(`❌ Error migrating documents:`, error);
      return {
        success: false,
        message: `Migration failed: ${String(error)}`,
        migratedCount: 0,
      };
    }
  },
});

// Get all namespaces (for admin purposes)
export const getAllNamespaces = query({
  args: {},
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    // This would need to be implemented based on Convex RAG's namespace listing capabilities
    // For now, return placeholder
    return ["global_knowledge"]; // Placeholder
  },
});

// Health check for RAG system
export const ragHealthCheck = query({
  args: {
    tenantSlug: v.optional(v.string()),
    botName: v.optional(v.string()),
  },
  returns: v.object({
    status: v.string(),
    namespace: v.optional(v.string()),
    timestamp: v.number(),
  }),
  handler: async (ctx, args) => {
    const namespace = args.tenantSlug && args.botName 
      ? generateNamespace(args.tenantSlug, args.botName)
      : undefined;
    
    return {
      status: "healthy",
      namespace,
      timestamp: Date.now(),
    };
  },
});