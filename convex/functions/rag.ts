import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "../_generated/server";

// Internal mutations and queries (can be in regular JS context)
export const createDocument = internalMutation({
  args: {
    title: v.string(),
    source: v.string(),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("knowledge_docs", {
      title: args.title,
      source: args.source,
      tags: args.tags,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const updateDocumentStatus = internalMutation({
  args: {
    docId: v.id("knowledge_docs"),
    status: v.union(v.literal("ingested"), v.literal("pending"), v.literal("failed")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.docId, {
      status: args.status,
    });
  },
});

export const storeChunk = internalMutation({
  args: {
    docId: v.id("knowledge_docs"),
    chunk: v.string(),
    embedding: v.array(v.float64()),
    tags: v.object({
      asa: v.optional(v.string()),
      tema: v.optional(v.string()),
      nivel: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("knowledge_chunks", {
      docId: args.docId,
      chunk: args.chunk,
      embedding: args.embedding,
      tags: args.tags,
    });
  },
});

export const vectorSearch = internalQuery({
  args: {
    queryVector: v.array(v.float64()),
    topK: v.number(),
    filters: v.optional(v.object({
      asa: v.optional(v.string()),
      tema: v.optional(v.string()),
      nivel: v.optional(v.string()),
    })),
  },
  returns: v.array(v.object({
    chunk: v.string(),
    score: v.number(),
    tags: v.object({
      asa: v.optional(v.string()),
      tema: v.optional(v.string()),
      nivel: v.optional(v.string()),
    }),
    docTitle: v.string(),
    docId: v.id("knowledge_docs"),
  })),
  handler: async (ctx, args) => {
    // Simplified implementation for now
    const allChunks = await ctx.db.query("knowledge_chunks").collect();
    
    // Return top results (placeholder implementation)
    const topResults = allChunks.slice(0, args.topK);

    // Enrich results with document information
    const enrichedResults = [];
    for (const result of topResults) {
      const doc = await ctx.db.get(result.docId);
      enrichedResults.push({
        chunk: result.chunk,
        score: 0.8, // Placeholder score
        tags: result.tags,
        docTitle: doc?.title || "Unknown Document",
        docId: result.docId,
      });
    }

    return enrichedResults;
  },
});

// Public queries for admin interface
export const getDocuments = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    return await ctx.db
      .query("knowledge_docs")
      .order("desc")
      .take(limit);
  },
});

export const getDocumentChunks = query({
  args: {
    docId: v.id("knowledge_docs"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 20;
    return await ctx.db
      .query("knowledge_chunks")
      .withIndex("by_doc", q => q.eq("docId", args.docId))
      .take(limit);
  },
});