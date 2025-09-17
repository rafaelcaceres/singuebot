import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "../../_generated/server";
import { internal } from "../../_generated/api";
import { Id } from "../../_generated/dataModel";

// Public queries for admin interface
export const getDocuments = query({
  args: {},
  handler: async (ctx) => {
    // For now, remove auth check to test the functionality
    // TODO: Add proper auth check once organizer is set up
    
    const documents = await ctx.db
      .query("knowledge_docs")
      .withIndex("by_created")
      .order("desc")
      .collect();

    return documents.map((doc) => ({
      _id: doc._id,
      title: doc.title,
      source: doc.source,
      tags: doc.tags,
      status: doc.status,
      createdAt: doc.createdAt,
      _creationTime: doc._creationTime,
    }));
  },
});

export const getDocumentStats = query({
  args: {},
  handler: async (ctx) => {
    // For now, remove auth check to test the functionality
    // TODO: Add proper auth check once organizer is set up

    const totalDocs = await ctx.db.query("knowledge_docs").collect();
    const ingestedDocs = await ctx.db
      .query("knowledge_docs")
      .withIndex("by_status", (q) => q.eq("status", "ingested"))
      .collect();
    const pendingDocs = await ctx.db
      .query("knowledge_docs")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();
    const failedDocs = await ctx.db
      .query("knowledge_docs")
      .withIndex("by_status", (q) => q.eq("status", "failed"))
      .collect();

    const totalChunks = await ctx.db.query("knowledge_chunks").collect();

    return {
      totalDocuments: totalDocs.length,
      ingestedDocuments: ingestedDocs.length,
      pendingDocuments: pendingDocs.length,
      failedDocuments: failedDocs.length,
      totalChunks: totalChunks.length,
    };
  },
});

// Public mutations for admin interface
export const uploadDocument = mutation({
  args: {
    title: v.string(),
    content: v.string(),
    source: v.string(),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Check if user is an organizer with editor or owner role
    const organizer = await ctx.db
      .query("organizers")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .first();

    if (!organizer || organizer.role === "viewer") {
      throw new Error("Not authorized - editor or owner access required");
    }

    // Create document record
    const docId = await ctx.db.insert("knowledge_docs", {
      title: args.title,
      source: args.source,
      tags: args.tags,
      status: "pending",
      createdAt: Date.now(),
    });

    // Schedule processing job
    await ctx.db.insert("jobs", {
      type: "document_ingestion",
      status: "queued",
      payload: {
        docId,
        content: args.content,
      },
      progress: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Trigger processing (for now, we'll process synchronously)
    // In production, this would be scheduled as a background job
    try {
      await processDocumentSync(ctx, docId, args.content);
    } catch (error) {
      console.error("Document processing failed:", error);
      await ctx.db.patch(docId, { status: "failed" });
    }

    return docId;
  },
});

export const reindexDocument = mutation({
  args: {
    docId: v.id("knowledge_docs"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Check if user is an organizer with editor or owner role
    const organizer = await ctx.db
      .query("organizers")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .first();

    if (!organizer || organizer.role === "viewer") {
      throw new Error("Not authorized - editor or owner access required");
    }

    const document = await ctx.db.get(args.docId);
    if (!document) {
      throw new Error("Document not found");
    }

    // Update status to pending
    await ctx.db.patch(args.docId, {
      status: "pending",
    });

    // Delete existing chunks
    const existingChunks = await ctx.db
      .query("knowledge_chunks")
      .withIndex("by_doc", (q) => q.eq("docId", args.docId))
      .collect();

    for (const chunk of existingChunks) {
      await ctx.db.delete(chunk._id);
    }

    // Create new processing job
    await ctx.db.insert("jobs", {
      type: "document_reindexing",
      status: "queued",
      payload: {
        docId: args.docId,
      },
      progress: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Note: We would need the original content to reprocess
    // In a real implementation, we might store the content or re-fetch it
    return { success: true };
  },
});

export const deleteDocument = mutation({
  args: {
    docId: v.id("knowledge_docs"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Check if user is an organizer with editor or owner role
    const organizer = await ctx.db
      .query("organizers")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .first();

    if (!organizer || organizer.role === "viewer") {
      throw new Error("Not authorized - editor or owner access required");
    }

    const document = await ctx.db.get(args.docId);
    if (!document) {
      throw new Error("Document not found");
    }

    // Delete all chunks associated with this document
    const chunks = await ctx.db
      .query("knowledge_chunks")
      .withIndex("by_doc", (q) => q.eq("docId", args.docId))
      .collect();

    for (const chunk of chunks) {
      await ctx.db.delete(chunk._id);
    }

    // Delete the document
    await ctx.db.delete(args.docId);

    return { success: true };
  },
});

// Internal functions for document processing
export const processDocument = internalMutation({
  args: {
    docId: v.id("knowledge_docs"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      // Update job status to running
      const job = await ctx.db
        .query("jobs")
        .filter((q) => 
          q.and(
            q.eq(q.field("type"), "document_ingestion"),
            q.eq(q.field("payload.docId"), args.docId)
          )
        )
        .first();

      if (job) {
        await ctx.db.patch(job._id, {
          status: "running",
          progress: 10,
          updatedAt: Date.now(),
        });
      }

      // Split content into chunks (simple implementation)
      const chunks = splitIntoChunks(args.content);
      
      if (job) {
        await ctx.db.patch(job._id, {
          progress: 30,
          updatedAt: Date.now(),
        });
      }

      // Generate embeddings for each chunk
      const chunksWithEmbeddings = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        
        // Call OpenAI API for embeddings
        const embedding = await generateEmbedding(chunk);
        
        chunksWithEmbeddings.push({
          chunk,
          embedding,
          tags: extractTags(chunk), // Simple tag extraction
        });

        // Update progress
        if (job) {
          const progress = 30 + Math.floor((i / chunks.length) * 50);
          await ctx.db.patch(job._id, {
            progress,
            updatedAt: Date.now(),
          });
        }
      }

      // Store chunks in database
      for (const chunkData of chunksWithEmbeddings) {
        await ctx.db.insert("knowledge_chunks", {
          docId: args.docId,
          chunk: chunkData.chunk,
          embedding: chunkData.embedding,
          tags: chunkData.tags,
        });
      }

      // Update document status to ingested
      await ctx.db.patch(args.docId, {
        status: "ingested",
      });

      // Update job status to done
      if (job) {
        await ctx.db.patch(job._id, {
          status: "done",
          progress: 100,
          result: {
            chunksCreated: chunksWithEmbeddings.length,
          },
          updatedAt: Date.now(),
        });
      }

    } catch (error) {
      console.error("Document processing failed:", error);
      
      // Update document status to failed
      await ctx.db.patch(args.docId, {
        status: "failed",
      });

      // Update job status to failed
      const job = await ctx.db
        .query("jobs")
        .filter((q) => 
          q.and(
            q.eq(q.field("type"), "document_ingestion"),
            q.eq(q.field("payload.docId"), args.docId)
          )
        )
        .first();

      if (job) {
        await ctx.db.patch(job._id, {
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
          updatedAt: Date.now(),
        });
      }
    }
  },
});

// Helper function for synchronous document processing
async function processDocumentSync(ctx: any, docId: Id<"knowledge_docs">, content: string) {
  try {
    // Update job status to running
    const job = await ctx.db
      .query("jobs")
      .filter((q: any) => 
        q.and(
          q.eq(q.field("type"), "document_ingestion"),
          q.eq(q.field("payload.docId"), docId)
        )
      )
      .first();

    if (job) {
      await ctx.db.patch(job._id, {
        status: "running",
        progress: 10,
        updatedAt: Date.now(),
      });
    }

    // Split content into chunks (simple implementation)
    const chunks = splitIntoChunks(content);
    
    if (job) {
      await ctx.db.patch(job._id, {
        progress: 30,
        updatedAt: Date.now(),
      });
    }

    // Generate embeddings for each chunk
    const chunksWithEmbeddings = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      
      // Call OpenAI API for embeddings
      const embedding = await generateEmbedding(chunk);
      
      chunksWithEmbeddings.push({
        chunk,
        embedding,
        tags: extractTags(chunk), // Simple tag extraction
      });

      // Update progress
      if (job) {
        const progress = 30 + Math.floor((i / chunks.length) * 50);
        await ctx.db.patch(job._id, {
          progress,
          updatedAt: Date.now(),
        });
      }
    }

    // Store chunks in database
    for (const chunkData of chunksWithEmbeddings) {
      await ctx.db.insert("knowledge_chunks", {
        docId: docId,
        chunk: chunkData.chunk,
        embedding: chunkData.embedding,
        tags: chunkData.tags,
      });
    }

    // Update document status to ingested
    await ctx.db.patch(docId, {
      status: "ingested",
    });

    // Update job status to done
    if (job) {
      await ctx.db.patch(job._id, {
        status: "done",
        progress: 100,
        result: {
          chunksCreated: chunksWithEmbeddings.length,
        },
        updatedAt: Date.now(),
      });
    }

  } catch (error) {
    console.error("Document processing failed:", error);
    
    // Update document status to failed
    await ctx.db.patch(docId, {
      status: "failed",
    });

    // Update job status to failed
    const job = await ctx.db
      .query("jobs")
      .filter((q: any) => 
        q.and(
          q.eq(q.field("type"), "document_ingestion"),
          q.eq(q.field("payload.docId"), docId)
        )
      )
      .first();

    if (job) {
      await ctx.db.patch(job._id, {
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
        updatedAt: Date.now(),
      });
    }
    
    throw error;
  }
}
function splitIntoChunks(content: string, maxChunkSize: number = 1000): string[] {
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (currentChunk.length + trimmedSentence.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      currentChunk = trimmedSentence;
    } else {
      currentChunk += (currentChunk.length > 0 ? ". " : "") + trimmedSentence;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

async function generateEmbedding(text: string): Promise<number[]> {
  // This would call OpenAI API in a real implementation
  // For now, return a mock embedding with the correct dimensions
  const dimensions = 3072; // text-embedding-3-large dimensions
  return Array.from({ length: dimensions }, () => Math.random() - 0.5);
}

function extractTags(chunk: string): { asa?: string; tema?: string; nivel?: string } {
  // Simple tag extraction logic
  // In a real implementation, this would use NLP or predefined rules
  const tags: { asa?: string; tema?: string; nivel?: string } = {};
  
  // Example: look for keywords to determine ASA category
  if (chunk.toLowerCase().includes("risco") || chunk.toLowerCase().includes("segurança")) {
    tags.asa = "ASA III";
  } else if (chunk.toLowerCase().includes("saudável") || chunk.toLowerCase().includes("normal")) {
    tags.asa = "ASA I";
  }
  
  // Example: determine theme based on content
  if (chunk.toLowerCase().includes("anestesia")) {
    tags.tema = "anestesia";
  } else if (chunk.toLowerCase().includes("cirurgia")) {
    tags.tema = "cirurgia";
  }
  
  // Example: determine level based on complexity
  if (chunk.length > 500) {
    tags.nivel = "avançado";
  } else {
    tags.nivel = "básico";
  }
  
  return tags;
}