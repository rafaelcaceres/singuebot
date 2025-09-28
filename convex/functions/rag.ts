import { components } from "../_generated/api";
import { RAG } from "@convex-dev/rag";
import { openai } from "@ai-sdk/openai";
import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";

// Global namespace for all knowledge documents
const GLOBAL_NAMESPACE = "global_knowledge";

export const rag = new RAG(components.rag, {
  textEmbeddingModel: openai.embedding("text-embedding-3-small"),
  embeddingDimension: 1536,
});

export const insertDocument = action({
  args: {
    document: v.string(),
    title: v.string(),
    hash: v.string(),
    format: v.optional(v.union(v.literal("pdf"), v.literal("md"), v.literal("txt"))),
  },
  handler: async (ctx, args) => {
    const result = await rag.add(ctx, {
      namespace: GLOBAL_NAMESPACE,
      title: args.title,
      contentHash: args.hash,
      text: args.document,
      metadata: {
        format: args.format || "txt",
        uploadedAt: Date.now(),
      },
    });
    return result;
  },
});

// Search function for tool-based RAG
export const searchKnowledge = internalAction({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const results = await rag.search(ctx, {
      namespace: GLOBAL_NAMESPACE,
      query: args.query,
      limit: args.limit ?? 5,
    });
    // add a search icon in console bellow
    console.log("🔎 RAG search results:", results);
    return results.results.map((result: any) => ({
      content: result.content?.[0]?.text || "",
      score: result.score,
      title: result.content?.[0]?.metadata?.title || "Untitled",
      metadata: result.content?.[0]?.metadata || {},
    }));
  },
});

// Replace document with new content
export const replaceDocument = action({
  args: {
    document: v.string(),
    title: v.string(),
    hash: v.string(),
    format: v.optional(v.union(v.literal("pdf"), v.literal("md"), v.literal("txt"))),
  },
  handler: async (ctx, args) => {
    // Remove existing document with same hash/title and add new one
    const result = await rag.add(ctx, {
      namespace: GLOBAL_NAMESPACE,
      title: args.title,
      contentHash: args.hash,
      text: args.document,
      metadata: {
        format: args.format || "txt",
        uploadedAt: Date.now(),
        replaced: true,
      },
    });
    return result;
  },
});

// Get all documents in the global namespace
export const listDocuments = action({
  args: {},
  handler: async (ctx, args) => {
    // This would need to be implemented based on Convex RAG's document listing capabilities
    // For now, return a placeholder
    return [];
  },
});

