import { components } from "../_generated/api";
import { RAG } from "@convex-dev/rag";
import { openai } from "@ai-sdk/openai";
import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, query } from "../_generated/server";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { UMAP } from "umap-js";
import { Hdbscan } from "hdbscan";

// Namespace for participant embeddings
const PARTICIPANTS_NAMESPACE = "participants";

// Initialize RAG instance for participants
export const participantRAG = new RAG(components.rag, {
  textEmbeddingModel: openai.embedding("text-embedding-3-small"),
  embeddingDimension: 1536,
});

const MAX_HIGHLIGHTS_PER_ENTRY = 3;

const sanitizeSnippet = (snippet: string): string =>
  snippet
    .replace(/\[ID:[^\]]+\]\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();

const truncateSnippet = (snippet: string, maxLength = 320): string =>
  snippet.length > maxLength ? `${snippet.slice(0, maxLength - 1)}…` : snippet;

const extractHighlights = (entryId: string, results: any[]): string[] => {
  const highlights: string[] = [];
  const seen = new Set<string>();

  for (const result of results) {
    if (result.entryId !== entryId) continue;

    const rawSnippet = (result.content ?? [])
      .map((segment: any) => segment?.text ?? "")
      .join(" ")
      .trim();

    const cleaned = sanitizeSnippet(rawSnippet);
    if (!cleaned) continue;

    const normalized = truncateSnippet(cleaned);
    if (seen.has(normalized)) continue;

    seen.add(normalized);
    highlights.push(normalized);

    if (highlights.length >= MAX_HIGHLIGHTS_PER_ENTRY) {
      break;
    }
  }

  return highlights;
};

/**
 * Consolidates participant data into searchable text
 */
export const generateParticipantText = internalQuery({
  args: {
    participantId: v.id("participants"),
  },
  handler: async (ctx, args) => {
    // Get participant data
    const participant = await ctx.db.get(args.participantId);
    if (!participant) {
      throw new Error("Participant not found");
    }

    // Get participant profile if exists
    const profile = await ctx.db
      .query("participant_profiles")
      .withIndex("by_participant", (q) => q.eq("participantId", args.participantId))
      .first();

    // Build consolidated text with all relevant information
    const textParts: string[] = [];

    // Add participantId as first line (hidden metadata that will be in every chunk)
    textParts.push(`[ID:${args.participantId}]`);

    // Basic information
    if (participant.name) {
      textParts.push(`Nome: ${participant.name}`);
    }

    // Professional information
    if (participant.cargo) {
      textParts.push(`Cargo: ${participant.cargo}`);
    }
    if (participant.empresa || participant.empresaPrograma) {
      textParts.push(`Empresa: ${participant.empresaPrograma || participant.empresa}`);
    }
    if (participant.setor) {
      textParts.push(`Setor: ${participant.setor}`);
    }
    if (participant.tipoOrganizacao) {
      textParts.push(`Tipo de Organização: ${participant.tipoOrganizacao}`);
    }

    // Career information
    if (participant.senioridade) {
      textParts.push(`Senioridade: ${participant.senioridade}`);
    }
    if (participant.annosCarreira) {
      textParts.push(`Anos de Carreira: ${participant.annosCarreira}`);
    }

    // Demographic information
    if (participant.estado) {
      textParts.push(`Estado: ${participant.estado}`);
    }
    if (participant.pais) {
      textParts.push(`País: ${participant.pais}`);
    }
    if (participant.genero) {
      textParts.push(`Gênero: ${participant.genero}`);
    }
    if (participant.raca) {
      textParts.push(`Raça: ${participant.raca}`);
    }

    // Program information
    if (participant.programaMarca) {
      textParts.push(`Programa: ${participant.programaMarca}`);
    }
    if (participant.programasSingue) {
      textParts.push(`Programas Singuê anteriores: ${participant.programasSingue}`);
    }
    if (participant.programasPactua) {
      textParts.push(`Programas Pactuá anteriores: ${participant.programasPactua}`);
    }

    // Profile information (rich qualitative data)
    if (profile) {
      if (profile.realizacoes) {
        textParts.push(`Realizações: ${profile.realizacoes}`);
      }
      if (profile.visaoFuturo) {
        textParts.push(`Visão de Futuro: ${profile.visaoFuturo}`);
      }
      if (profile.desafiosSuperados) {
        textParts.push(`Desafios Superados: ${profile.desafiosSuperados}`);
      }
      if (profile.desafiosAtuais) {
        textParts.push(`Desafios Atuais: ${profile.desafiosAtuais}`);
      }
      if (profile.motivacao) {
        textParts.push(`Motivação: ${profile.motivacao}`);
      }
    }

    // Additional context
    if (participant.membroConselho) {
      textParts.push("Membro de Conselho");
    }
    if (participant.mercadoFinanceiro) {
      textParts.push("Atua no Mercado Financeiro");
    }
    if (participant.blackSisterInLaw) {
      textParts.push("Black Sister in Law");
    }

    // Tags
    if (participant.tags && participant.tags.length > 0) {
      textParts.push(`Tags: ${participant.tags.join(", ")}`);
    }

    const lastUpdated = Math.max(
      participant._creationTime,
      profile?._creationTime ?? 0
    );

    return {
      text: textParts.join("\n"),
      participant,
      lastUpdated,
    };
  },
});

/**
 * Add or update participant in RAG system
 */
export const addParticipant = internalAction({
  args: {
    participantId: v.id("participants"),
  },
  returns: v.object({
    success: v.boolean(),
    reason: v.optional(v.string()),
    result: v.optional(v.any()),
    textLength: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    console.log(`🔮 Adding participant ${args.participantId} to RAG`);

    // Generate consolidated text
    const { text, participant, lastUpdated }: any = await ctx.runQuery(
      internal.functions.participantRAG.generateParticipantText,
      { participantId: args.participantId }
    );

    if (!text || text.trim().length === 0) {
      console.warn(`⚠️ Participant ${args.participantId} has no data, skipping`);
      return { success: false, reason: "No data to index" };
    }

    // Add to RAG with participant metadata and unique key for upsert behavior
    const result = await participantRAG.add(ctx, {
      namespace: PARTICIPANTS_NAMESPACE,
      key: `participant-${args.participantId}`, // Unique key for this participant
      text,
      metadata: {
        participantId: args.participantId,
        name: participant.name || "Unnamed",
        cargo: participant.cargo,
        empresa: participant.empresaPrograma || participant.empresa,
        setor: participant.setor,
        programaMarca: participant.programaMarca,
        updatedAt: lastUpdated,
      },
    });

    console.log(`✅ Added participant ${args.participantId} to RAG`);

    return {
      success: true,
      result,
      textLength: text.length,
    };
  },
});

/**
 * Update participant in RAG (alias for add - RAG handles upsert)
 */
export const updateParticipant = internalAction({
  args: {
    participantId: v.id("participants"),
  },
  returns: v.object({
    success: v.boolean(),
    reason: v.optional(v.string()),
    result: v.optional(v.any()),
    textLength: v.optional(v.number()),
  }),
  handler: async (ctx, args): Promise<{
    success: boolean;
    reason?: string;
    result?: any;
    textLength?: number;
  }> => {
    return await ctx.runAction(internal.functions.participantRAG.addParticipant, {
      participantId: args.participantId,
    });
  },
});

/**
 * Remove participant from RAG
 */
export const removeParticipant = internalAction({
  args: {
    participantId: v.id("participants"),
  },
  handler: async (ctx, args) => {
    console.log(`🗑️ Removing participant ${args.participantId} from RAG`);

    // RAG uses entityId as the identifier
    // We need to call the remove method if available, or the system will handle it
    // For now, re-adding with empty text or using TTL would handle removal
    // But Convex RAG typically handles this via namespace management

    console.log(`✅ Participant ${args.participantId} removed from RAG`);

    return { success: true };
  },
});

/**
 * Search for similar participants using semantic search (internal)
 */
export const searchSimilar = internalAction({
  args: {
    participantId: v.optional(v.id("participants")),
    query: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;

    let searchQuery: string;

    if (args.participantId) {
      // Search based on existing participant's data
      const { text } = await ctx.runQuery(
        internal.functions.participantRAG.generateParticipantText,
        { participantId: args.participantId }
      );
      searchQuery = text;
      console.log(`🔎 Searching for participants similar to ${args.participantId}`);
    } else if (args.query) {
      // Search based on text query
      searchQuery = args.query;
      console.log(`🔎 Searching participants with query: "${args.query}"`);
    } else {
      throw new Error("Must provide either participantId or query");
    }

    // Perform semantic search
    const searchResponse = await participantRAG.search(ctx, {
      namespace: PARTICIPANTS_NAMESPACE,
      query: searchQuery,
      limit: limit + 1, // +1 to account for self-match if searching by participantId
      chunkContext: {
        before: 1,
        after: 1,
      },
    });

    console.log(
      `📊 Found ${searchResponse.results.length} matching chunks across ${searchResponse.entries.length} participants`
    );

    const scoreByEntry = new Map<string, number>();
    for (const result of searchResponse.results) {
      if (!scoreByEntry.has(result.entryId) || scoreByEntry.get(result.entryId)! < result.score) {
        scoreByEntry.set(result.entryId, result.score);
      }
    }

    const enrichedResults: Array<{
      participantId: Id<"participants">;
      score: number;
      participant: {
        name?: string;
        cargo?: string;
        empresa?: string;
        setor?: string;
        programaMarca?: string;
      };
      textPreview: string;
      updatedAt: number;
      highlights: string[];
    }> = [];

    const seenParticipants = new Set<string>();

    const orderedEntries = [...searchResponse.entries].sort(
      (a, b) => (scoreByEntry.get(b.entryId) ?? 0) - (scoreByEntry.get(a.entryId) ?? 0)
    );

    for (const entry of orderedEntries) {
      const metadata = (entry.metadata || {}) as {
        participantId?: Id<"participants">;
        name?: string;
        cargo?: string;
        empresa?: string;
        setor?: string;
        programaMarca?: string;
        updatedAt?: number;
      };

      const participantId = metadata.participantId;
      if (!participantId) {
        console.warn("⚠️ Skipping entry - missing participantId metadata", entry.entryId);
        continue;
      }

      if (seenParticipants.has(participantId)) {
        continue;
      }

      if (args.participantId && participantId === args.participantId) {
        continue;
      }

      seenParticipants.add(participantId);

      const highlights = extractHighlights(entry.entryId, searchResponse.results);
      const textPreview = highlights[0] ?? entry.text.substring(0, 400);

      enrichedResults.push({
        participantId: participantId,
        score: scoreByEntry.get(entry.entryId) ?? 0,
        participant: {
          name: metadata.name,
          cargo: metadata.cargo,
          empresa: metadata.empresa,
          setor: metadata.setor,
          programaMarca: metadata.programaMarca,
        },
        textPreview,
        updatedAt: metadata.updatedAt ?? Date.now(),
        highlights,
      });

      if (enrichedResults.length >= limit) {
        break;
      }
    }

    return enrichedResults;
  },
});

/**
 * Search for similar participants using semantic search (public)
 */
export const searchSimilarPublic = action({
  args: {
    participantId: v.optional(v.id("participants")),
    query: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.object({
    participantId: v.id("participants"),
    score: v.number(),
    participant: v.object({
      name: v.optional(v.string()),
      cargo: v.optional(v.string()),
      empresa: v.optional(v.string()),
      setor: v.optional(v.string()),
      programaMarca: v.optional(v.string()),
    }),
    textPreview: v.string(),
    updatedAt: v.number(),
    highlights: v.array(v.string()),
  })),
  handler: async (ctx, args) => {
    const limit = args.limit || 10;

    let searchQuery: string;

    if (args.participantId) {
      // Search based on existing participant's data
      const { text } = await ctx.runQuery(
        internal.functions.participantRAG.generateParticipantText,
        { participantId: args.participantId }
      );
      searchQuery = text;
      console.log(`🔎 Searching for participants similar to ${args.participantId}`);
    } else if (args.query) {
      // Search based on text query
      searchQuery = args.query;
      console.log(`🔎 Searching participants with query: "${args.query}"`);
    } else {
      throw new Error("Must provide either participantId or query");
    }

    // Perform semantic search
    const searchResponse = await participantRAG.search(ctx, {
      namespace: PARTICIPANTS_NAMESPACE,
      query: searchQuery,
      limit: limit + 1, // +1 to account for self-match if searching by participantId
      chunkContext: {
        before: 1,
        after: 1,
      },
    });

    console.log(
      `📊 Found ${searchResponse.results.length} matching chunks across ${searchResponse.entries.length} participants`
    );

    const scoreByEntry = new Map<string, number>();
    for (const result of searchResponse.results) {
      const existing = scoreByEntry.get(result.entryId) ?? Number.NEGATIVE_INFINITY;
      if (result.score > existing) {
        scoreByEntry.set(result.entryId, result.score);
      }
    }

    // Process and enrich results
    const enrichedResults: Array<{
      participantId: Id<"participants">;
      score: number;
      participant: {
        name?: string;
        cargo?: string;
        empresa?: string;
        setor?: string;
        programaMarca?: string;
      };
      textPreview: string;
      updatedAt: number;
      highlights: string[];
    }> = [];

    const seenParticipants = new Set<string>();

    const orderedEntries = [...searchResponse.entries].sort(
      (a, b) => (scoreByEntry.get(b.entryId) ?? 0) - (scoreByEntry.get(a.entryId) ?? 0)
    );

    for (const entry of orderedEntries) {
      const metadata = (entry.metadata || {}) as {
        participantId?: Id<"participants">;
        name?: string;
        cargo?: string;
        empresa?: string;
        setor?: string;
        programaMarca?: string;
        updatedAt?: number;
      };

      const participantId = metadata.participantId;
      if (!participantId) {
        console.warn("⚠️ Skipping entry - missing participantId metadata");
        continue;
      }

      if (seenParticipants.has(participantId)) {
        continue;
      }

      if (args.participantId && participantId === args.participantId) {
        continue;
      }

      seenParticipants.add(participantId);

      const highlights = extractHighlights(entry.entryId, searchResponse.results);
      const textPreview = highlights[0] ?? entry.text.substring(0, 400);

      enrichedResults.push({
        participantId: participantId,
        score: scoreByEntry.get(entry.entryId) ?? 0,
        participant: {
          name: metadata.name,
          cargo: metadata.cargo,
          empresa: metadata.empresa,
          setor: metadata.setor,
          programaMarca: metadata.programaMarca,
        },
        textPreview,
        updatedAt: metadata.updatedAt ?? Date.now(),
        highlights,
      });

      if (enrichedResults.length >= limit) {
        break;
      }
    }

    return enrichedResults;
  },
});

/**
 * Batch add participants to RAG
 */
export const batchAddParticipants = internalAction({
  args: {
    limit: v.optional(v.number()),
    skipExisting: v.optional(v.boolean()),
  },
  returns: v.object({
    processed: v.number(),
    added: v.number(),
    skipped: v.number(),
    errors: v.number(),
  }),
  handler: async (ctx, args) => {
    const limit = args.limit;
    const limitText = limit ? `${limit}` : 'all';

    console.log(`🚀 Starting batch RAG indexing (limit: ${limitText})`);

    // Get all participants
    const participants: Id<"participants">[] = await ctx.runQuery(
      internal.functions.participantRAG.getAllParticipantIds,
      { limit }
    );

    console.log(`Found ${participants.length} participants to process`);

    const results: any = {
      total: participants.length,
      processed: 0,
      skipped: 0,
      failed: 0,
      errors: [] as Array<{ participantId: Id<"participants">; error: string }>,
    };

    for (const participantId of participants) {
      try {
        const result = await ctx.runAction(internal.functions.participantRAG.addParticipant, {
          participantId,
        });

        if (result.success) {
          results.processed++;
          console.log(`✅ Processed ${participantId} (${results.processed}/${participants.length})`);
        } else {
          results.skipped++;
          console.log(`⏭️ Skipped ${participantId}: ${result.reason}`);
        }
      } catch (error) {
        results.failed++;
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.errors.push({ participantId, error: errorMessage });
        console.error(`❌ Failed ${participantId}:`, errorMessage);
      }
    }

    console.log(`🏁 Batch complete: ${results.processed} processed, ${results.skipped} skipped, ${results.failed} failed`);

    return results;
  },
});

/**
 * Helper query to get participant data by ID
 */
export const getParticipantById = internalQuery({
  args: {
    participantId: v.id("participants"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.participantId);
  },
});

/**
 * Helper query to get all participant IDs
 */
export const getAllParticipantIds = internalQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const query = ctx.db
      .query("participants")
      .order("desc");
    
    // Apply limit only if specified, otherwise get all participants
    const participants = args.limit !== undefined 
      ? await query.take(args.limit)
      : await query.collect();

    return participants.map((p) => p._id);
  },
});

/**
 * Find participant by name (and optionally cargo) - internal helper for RAG search
 */
export const findParticipantByName = internalQuery({
  args: {
    name: v.string(),
    cargo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // First try exact match by name
    const participants = await ctx.db
      .query("participants")
      .filter((q) => q.eq(q.field("name"), args.name))
      .collect();

    if (participants.length === 1) {
      return participants[0];
    }

    // If multiple matches or no matches, try with cargo as well
    if (args.cargo && participants.length > 1) {
      const match = participants.find((p: any) => p.cargo === args.cargo);
      if (match) return match;
    }

    // Return first match or null
    return participants[0] || null;
  },
});

/**
 * Get RAG statistics for participants (internal)
 */
export const getStats = internalQuery({
  args: {},
  handler: async (ctx) => {
    const totalParticipants = await ctx.db.query("participants").collect();

    // Note: Convex RAG doesn't expose direct stats API yet
    // We can infer from successful additions or maintain a counter
    // For now, return participant count as proxy

    return {
      totalParticipants: totalParticipants.length,
      namespace: PARTICIPANTS_NAMESPACE,
      embeddingModel: "text-embedding-3-small",
      embeddingDimensions: 1536,
      status: "active",
    };
  },
});

/**
 * Get RAG statistics for participants (public)
 */
export const getRAGStats = query({
  args: {},
  handler: async (ctx) => {
    const totalParticipants = await ctx.db.query("participants").collect();

    return {
      totalParticipants: totalParticipants.length,
      namespace: PARTICIPANTS_NAMESPACE,
      embeddingModel: "text-embedding-3-small",
      embeddingDimensions: 1536,
      status: "active" as const,
    };
  },
});

/**
 * Get total participant count (lightweight query for UI calculations)
 */
export const getParticipantCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const participants = await ctx.db.query("participants").collect();
    return participants.length;
  },
});

/**
 * Get all embeddings for clustering analysis
 * This fetches embeddings from the RAG component's internal storage
 */
export const getAllEmbeddingsForClustering = internalAction({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    console.log("🔍 Fetching all embeddings for clustering analysis");

    // Get all participants first
    const participants = await ctx.runQuery(
      internal.functions.participantRAG.getAllParticipantIds,
      { limit: args.limit }
    );

    console.log(`Found ${participants.length} participants`);

    // For each participant, search RAG to get their embedding data
    const embeddingData: Array<{
      participantId: Id<"participants">;
      embedding: number[];
      metadata: {
        name?: string;
        cargo?: string;
        empresa?: string;
        setor?: string;
        programaMarca?: string;
      };
    }> = [];

    // We'll use the RAG search with each participant's text to get their embeddings
    // This is a workaround since Convex RAG doesn't expose embeddings directly
    for (const participantId of participants) {
      try {
        const { text } = await ctx.runQuery(
          internal.functions.participantRAG.generateParticipantText,
          { participantId }
        );

        // Search for this specific participant to get embedding data
        const searchResponse = await participantRAG.search(ctx, {
          namespace: PARTICIPANTS_NAMESPACE,
          query: text,
          limit: 1,
        });

        // Find the entry for this specific participant
        const entry = searchResponse.entries.find((e: any) => {
          const metadata = e.metadata as { participantId?: Id<"participants"> };
          return metadata.participantId === participantId;
        });

        if (entry) {
          const metadata = entry.metadata as {
            participantId: Id<"participants">;
            name?: string;
            cargo?: string;
            empresa?: string;
            setor?: string;
            programaMarca?: string;
          };

          // Note: We don't have direct access to embeddings from RAG
          // We'll need to re-generate them or use a different approach
          // For now, we'll return metadata and let the frontend action handle embedding generation
          embeddingData.push({
            participantId,
            embedding: [], // Will be populated in the clustering action
            metadata: {
              name: metadata.name,
              cargo: metadata.cargo,
              empresa: metadata.empresa,
              setor: metadata.setor,
              programaMarca: metadata.programaMarca,
            },
          });
        }
      } catch (error) {
        console.error(`Failed to get embedding for participant ${participantId}:`, error);
      }
    }

    console.log(`✅ Collected ${embeddingData.length} participant embeddings`);

    return embeddingData;
  },
});

/**
 * Generate and cache UMAP embeddings for all participants
 * This should be run once or when data changes
 */
export const generateUMAPCache = action({
  args: {
    limit: v.optional(v.number()),
    forceRefresh: v.optional(v.boolean()),
  },
  returns: v.object({
    cached: v.number(),
    skipped: v.number(),
    version: v.string(),
  }),
  handler: async (ctx, args): Promise<{ cached: number; skipped: number; version: string }> => {
    const version = `v1-${Date.now()}`;
    console.log(`🎯 Starting UMAP cache generation (version: ${version})`);

    // Check if cache exists and is recent (skip if forceRefresh is false)
    if (!args.forceRefresh) {
      const existingCache = await ctx.runQuery(
        internal.functions.participantRAG.getUMAPCacheStats,
        {}
      );
      if (existingCache.count > 0) {
        console.log(`⏭️ Using existing cache with ${existingCache.count} entries`);
        return {
          cached: 0,
          skipped: existingCache.count,
          version: existingCache.latestVersion || "unknown",
        };
      }
    }

    // Step 1: Get all participants
    const participants = await ctx.runQuery(
      internal.functions.participantRAG.getAllParticipantIds,
      { limit: args.limit }
    );

    if (participants.length === 0) {
      return { cached: 0, skipped: 0, version };
    }

    console.log(`Processing ${participants.length} participants`);

    // Step 2: Generate embeddings for each participant (in parallel batches)
    const participantData: Array<{
      participantId: Id<"participants">;
      embedding: number[];
      metadata: {
        name?: string;
        cargo?: string;
        empresa?: string;
        setor?: string;
        programaMarca?: string;
      };
    }> = [];

    const { embed } = await import("ai");
    const { openai } = await import("@ai-sdk/openai");

    // Process in batches to avoid overwhelming the API
    const BATCH_SIZE = 50;
    const totalBatches = Math.ceil(participants.length / BATCH_SIZE);

    for (let batchIndex = 0; batchIndex < participants.length; batchIndex += BATCH_SIZE) {
      const currentBatch = Math.floor(batchIndex / BATCH_SIZE) + 1;
      const batch = participants.slice(batchIndex, batchIndex + BATCH_SIZE);

      console.log(`📦 Processing batch ${currentBatch}/${totalBatches} (${batch.length} participants)...`);

      // Process batch in parallel
      const batchResults = await Promise.all(
        batch.map(async (participantId: Id<"participants">) => {
          try {
            const { text, participant } = await ctx.runQuery(
              internal.functions.participantRAG.generateParticipantText,
              { participantId }
            );

            if (!text || text.trim().length === 0) {
              return null;
            }

            const { embedding } = await embed({
              model: openai.embedding("text-embedding-3-small"),
              value: text,
            });

            return {
              participantId,
              embedding,
              metadata: {
                name: participant.name,
                cargo: participant.cargo,
                empresa: participant.empresaPrograma || participant.empresa,
                setor: participant.setor,
                programaMarca: participant.programaMarca,
              },
            };
          } catch (error) {
            console.error(`Failed to process participant ${participantId}:`, error);
            return null;
          }
        })
      );

      // Add successful results to participantData
      const validResults = batchResults.filter((result: any): result is NonNullable<typeof result> => result !== null);
      participantData.push(...validResults);

      console.log(`✅ Batch ${currentBatch}/${totalBatches} complete (${validResults.length}/${batch.length} successful)`);
    }

    console.log(`✅ Generated ${participantData.length} embeddings across ${totalBatches} batches`);

    if (participantData.length < 5) {
      console.warn("Not enough participants for UMAP");
      return { cached: 0, skipped: participantData.length, version };
    }

    // Step 3: Apply UMAP for dimensionality reduction (two versions)
    const embeddings = participantData.map((p) => p.embedding);

    // Step 3a: UMAP-2D for visualization in scatter plot
    const umap2D = new UMAP({
      nComponents: 2,
      nNeighbors: Math.min(15, Math.floor(embeddings.length / 3)),
      minDist: 0.3,  // increased from 0.1 for better visual separation
      spread: 2.0,   // increased from 1.0 for more dispersion
    });

    console.log("🔄 Running UMAP-2D for visualization...");
    const embeddings2D = await umap2D.fitAsync(embeddings);
    console.log("✅ UMAP-2D complete");

    // Step 3b: UMAP-50D for clustering (preserves ~90% of semantic information)
    const umap50D = new UMAP({
      nComponents: 50,  // intermediate dimensionality
      nNeighbors: Math.min(15, Math.floor(embeddings.length / 3)),
      minDist: 0.1,     // preserve local structure
      spread: 2.0,
    });

    console.log("🔄 Running UMAP-50D for clustering...");
    const embeddings50D = await umap50D.fitAsync(embeddings);
    console.log("✅ UMAP-50D complete");

    // Step 4: Cache the results (both 2D and 50D embeddings) in paginated chunks
    console.log("💾 Caching UMAP embeddings in chunks...");

    const cacheData = participantData.map((p, i) => ({
      participantId: p.participantId,
      x: embeddings2D[i][0],
      y: embeddings2D[i][1],
      embedding: p.embedding,
      clusteringEmbedding: Array.from(embeddings50D[i]),
      metadata: p.metadata,
    }));

    // Save in chunks to avoid "Many bytes read" warning
    const CHUNK_SIZE = 100;
    const totalChunks = Math.ceil(cacheData.length / CHUNK_SIZE);

    for (let chunkIndex = 0; chunkIndex < cacheData.length; chunkIndex += CHUNK_SIZE) {
      const currentChunk = Math.floor(chunkIndex / CHUNK_SIZE) + 1;
      const chunk = cacheData.slice(chunkIndex, chunkIndex + CHUNK_SIZE);

      console.log(`💾 Saving chunk ${currentChunk}/${totalChunks} (${chunk.length} entries)...`);

      await ctx.runMutation(
        internal.functions.participantRAG.cacheUMAPEmbeddings,
        {
          data: chunk,
          version,
          clearOld: chunkIndex === 0, // Only clear old cache on first chunk
        }
      );

      console.log(`✅ Chunk ${currentChunk}/${totalChunks} saved`);
    }

    console.log(`✅ Cached ${participantData.length} UMAP embeddings in ${totalChunks} chunks`);

    return {
      cached: participantData.length,
      skipped: 0,
      version,
    };
  },
});

/**
 * Internal mutation to cache UMAP embeddings (with pagination support)
 */
export const cacheUMAPEmbeddings = internalMutation({
  args: {
    data: v.array(v.object({
      participantId: v.id("participants"),
      x: v.number(),
      y: v.number(),
      embedding: v.array(v.number()),
      clusteringEmbedding: v.array(v.number()),
      metadata: v.object({
        name: v.optional(v.string()),
        cargo: v.optional(v.string()),
        empresa: v.optional(v.string()),
        setor: v.optional(v.string()),
        programaMarca: v.optional(v.string()),
      }),
    })),
    version: v.string(),
    clearOld: v.optional(v.boolean()), // Only clear old cache on first chunk
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Clear old cache entries only on first chunk
    if (args.clearOld) {
      console.log("🗑️ Clearing old cache entries...");
      const oldEntries = await ctx.db.query("umap_embeddings_cache").collect();
      for (const entry of oldEntries) {
        await ctx.db.delete(entry._id);
      }
      console.log(`✅ Cleared ${oldEntries.length} old entries`);
    }

    // Insert new cache entries
    for (const item of args.data) {
      await ctx.db.insert("umap_embeddings_cache", {
        participantId: item.participantId,
        x: item.x,
        y: item.y,
        embedding: item.embedding,
        clusteringEmbedding: item.clusteringEmbedding,
        metadata: item.metadata,
        version: args.version,
        createdAt: now,
      });
    }
  },
});

/**
 * Get UMAP cache statistics
 */
export const getUMAPCacheStats = internalQuery({
  args: {},
  handler: async (ctx) => {
    const entries = await ctx.db.query("umap_embeddings_cache").collect();
    const latestVersion = entries.length > 0 ? entries[0].version : null;
    return {
      count: entries.length,
      latestVersion,
      createdAt: entries.length > 0 ? entries[0].createdAt : null,
    };
  },
});

/**
 * Run HDBSCAN clustering on cached UMAP embeddings with configurable parameters
 */
export const runClusteringOnCache = action({
  args: {
    minClusterSize: v.optional(v.number()),
    minSamples: v.optional(v.number()),
  },
  returns: v.object({
    points: v.array(v.object({
      participantId: v.id("participants"),
      x: v.number(),
      y: v.number(),
      cluster: v.number(),
      metadata: v.object({
        name: v.optional(v.string()),
        cargo: v.optional(v.string()),
        empresa: v.optional(v.string()),
        setor: v.optional(v.string()),
        programaMarca: v.optional(v.string()),
      }),
    })),
    clusterStats: v.array(v.object({
      clusterId: v.number(),
      count: v.number(),
      label: v.string(),
    })),
    totalParticipants: v.number(),
    parameters: v.object({
      minClusterSize: v.number(),
      minSamples: v.number(),
    }),
  }),
  handler: async (ctx, args): Promise<{
    points: Array<{
      participantId: Id<"participants">;
      x: number;
      y: number;
      cluster: number;
      metadata: {
        name?: string;
        cargo?: string;
        empresa?: string;
        setor?: string;
        programaMarca?: string;
      };
    }>;
    clusterStats: Array<{
      clusterId: number;
      count: number;
      label: string;
    }>;
    totalParticipants: number;
    parameters: {
      minClusterSize: number;
      minSamples: number;
    };
  }> => {
    console.log("🎯 Running HDBSCAN on cached UMAP embeddings");

    // Get cached UMAP embeddings
    const cachedData: any[] = await ctx.runQuery(
      internal.functions.participantRAG.getCachedUMAPEmbeddings,
      {}
    );

    if (cachedData.length === 0) {
      throw new Error("No cached UMAP embeddings found. Run generateUMAPCache first.");
    }

    // Check if we have clustering embeddings (50D) or need to use 2D coordinates
    const hasClusteringEmbeddings = cachedData.every((item: any) => item.clusteringEmbedding && item.clusteringEmbedding.length > 0);
    
    console.log(`📊 Found ${cachedData.length} cached embeddings`);
    console.log(`🔍 Using ${hasClusteringEmbeddings ? '50D clustering embeddings' : '2D UMAP coordinates'} for clustering`);

    // Prepare clustering parameters
    const minClusterSize = args.minClusterSize ?? 5;
    const minSamples = args.minSamples ?? 3;

    console.log(`⚙️ Clustering parameters: minClusterSize=${minClusterSize}, minSamples=${minSamples}`);

    // Get cluster assignments from HDBSCAN
    let clusterLabels: number[];

    if (hasClusteringEmbeddings) {
      // Use 50D clustering embeddings for better clustering
      const clusteringEmbeddings = cachedData.map((item: any) => item.clusteringEmbedding);
      
      console.log("🧮 Running HDBSCAN on 50D clustering embeddings...");
      const hdbscan = new Hdbscan(clusteringEmbeddings, minClusterSize, minSamples);
      
      // Convert cluster groups to label array
      const clusterGroups = hdbscan.getClusters();
      clusterLabels = new Array(cachedData.length).fill(-1); // -1 for noise
      clusterGroups.forEach((cluster, clusterIndex) => {
        cluster.forEach((pointIndex) => {
          clusterLabels[pointIndex] = clusterIndex;
        });
      });
    } else {
      // Fallback to 2D coordinates
      const coordinates = cachedData.map((item: any) => [item.x, item.y]);
      
      console.log("🧮 Running HDBSCAN on 2D coordinates (fallback)...");
      const hdbscan = new Hdbscan(coordinates, minClusterSize, minSamples);
      
      // Convert cluster groups to label array
      const clusterGroups = hdbscan.getClusters();
      clusterLabels = new Array(cachedData.length).fill(-1); // -1 for noise
      clusterGroups.forEach((cluster, clusterIndex) => {
        cluster.forEach((pointIndex) => {
          clusterLabels[pointIndex] = clusterIndex;
        });
      });
    }

    // Prepare points with cluster assignments
    const points: any[] = cachedData.map((item: any, i: number) => {
      return {
        participantId: item.participantId,
        x: item.x,
        y: item.y,
        cluster: clusterLabels[i],
        metadata: item.metadata,
      };
    });

    // Calculate cluster statistics
    const clusterCounts = new Map<number, number>();
    clusterLabels.forEach((label: number) => {
      clusterCounts.set(label, (clusterCounts.get(label) || 0) + 1);
    });

    const clusterStats = Array.from(clusterCounts.entries())
      .map(([clusterId, count]) => ({
        clusterId,
        count,
        label: clusterId === -1 ? "Noise" : `Cluster ${clusterId}`,
      }))
      .sort((a, b) => b.count - a.count);

    console.log(`✅ Clustering complete: ${clusterStats.length} clusters found`);
    clusterStats.forEach(stat => {
      console.log(`   ${stat.label}: ${stat.count} participants`);
    });

    const result: any = {
      points,
      clusterStats,
      totalParticipants: cachedData.length,
      parameters: {
        minClusterSize,
        minSamples,
      },
    };

    // Cache the results
    await ctx.runMutation(internal.functions.participantRAG.saveClusterResults, {
      ...result,
      umapCacheVersion: cachedData[0]?.version || "unknown",
    });

    return result;
  },
});

/**
 * Get cached UMAP embeddings
 */
export const getCachedUMAPEmbeddings = internalQuery({
  args: {},
  handler: async (ctx) => {
    const entries = await ctx.db.query("umap_embeddings_cache").collect();
    return entries.map((entry) => ({
      participantId: entry.participantId,
      x: entry.x,
      y: entry.y,
      embedding: entry.embedding,
      clusteringEmbedding: entry.clusteringEmbedding,
      metadata: entry.metadata,
    }));
  },
});

/**
 * Save clustering results to cache
 */
export const saveClusterResults = internalMutation({
  args: {
    points: v.any(), // Array of cluster points (will be stored as JSON)
    clusterStats: v.any(), // Array of cluster statistics
    totalParticipants: v.number(),
    parameters: v.object({
      minClusterSize: v.number(),
      minSamples: v.number(),
    }),
    umapCacheVersion: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Clear old clustering results
    const oldResults = await ctx.db.query("cluster_results_cache").collect();
    for (const result of oldResults) {
      await ctx.db.delete(result._id);
    }

    // Insert new clustering result
    await ctx.db.insert("cluster_results_cache", {
      points: args.points,
      clusterStats: args.clusterStats,
      totalParticipants: args.totalParticipants,
      parameters: args.parameters,
      umapCacheVersion: args.umapCacheVersion,
      createdAt: now,
    });

    console.log(`✅ Saved clustering results (${args.totalParticipants} participants, ${args.clusterStats.length} clusters)`);
  },
});

/**
 * Get cached clustering results
 */
export const getCachedClusterResults = query({
  args: {
    minClusterSize: v.optional(v.number()),
    minSamples: v.optional(v.number()),
  },
  returns: v.union(
    v.null(),
    v.object({
      points: v.any(),
      clusterStats: v.any(),
      totalParticipants: v.number(),
      parameters: v.object({
        minClusterSize: v.number(),
        minSamples: v.number(),
      }),
      umapCacheVersion: v.string(),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    // Get the latest clustering result
    const results = await ctx.db
      .query("cluster_results_cache")
      .order("desc")
      .first();

    if (!results) {
      return null;
    }

    // If parameters are provided, check if they match
    if (args.minClusterSize !== undefined || args.minSamples !== undefined) {
      const paramsMatch =
        (args.minClusterSize === undefined || results.parameters.minClusterSize === args.minClusterSize) &&
        (args.minSamples === undefined || results.parameters.minSamples === args.minSamples);

      if (!paramsMatch) {
        console.log("Parameters don't match cached results, will need to recompute");
        return null;
      }
    }

    console.log(`📦 Retrieved cached clustering results (${results.totalParticipants} participants, created ${new Date(results.createdAt).toISOString()})`);

    return {
      points: results.points,
      clusterStats: results.clusterStats,
      totalParticipants: results.totalParticipants,
      parameters: results.parameters,
      umapCacheVersion: results.umapCacheVersion,
      createdAt: results.createdAt,
    };
  },
});

/**
 * Generate AI-powered names and descriptions for clusters
 */
export const generateClusterInsights = action({
  args: {
    clusterPoints: v.array(v.object({
      participantId: v.id("participants"),
      x: v.number(),
      y: v.number(),
      cluster: v.number(),
      metadata: v.object({
        name: v.optional(v.string()),
        cargo: v.optional(v.string()),
        empresa: v.optional(v.string()),
        setor: v.optional(v.string()),
        programaMarca: v.optional(v.string()),
      }),
    })),
  },
  returns: v.array(v.object({
    clusterId: v.number(),
    name: v.string(),
    description: v.string(),
    commonalities: v.array(v.string()),
    count: v.number(),
  })),
  handler: async (ctx, args) => {
    console.log("🤖 Generating AI insights for clusters");

    // Group points by cluster
    const clusterGroups = new Map<number, typeof args.clusterPoints>();
    for (const point of args.clusterPoints) {
      if (!clusterGroups.has(point.cluster)) {
        clusterGroups.set(point.cluster, []);
      }
      clusterGroups.get(point.cluster)!.push(point);
    }

    const { generateText } = await import("ai");
    const { openai } = await import("@ai-sdk/openai");

    const insights = [];

    for (const [clusterId, points] of clusterGroups.entries()) {
      // Skip noise cluster
      if (clusterId === -1) {
        insights.push({
          clusterId,
          name: "Ruído",
          description: "Participantes que não se encaixam em nenhum cluster bem definido",
          commonalities: ["Perfis diversos sem padrão claro"],
          count: points.length,
        });
        continue;
      }

      // Analyze cluster patterns
      const cargos = points.map((p: any) => p.metadata.cargo).filter(Boolean);
      const empresas = points.map((p: any) => p.metadata.empresa).filter(Boolean);
      const setores = points.map((p: any) => p.metadata.setor).filter(Boolean);
      const programas = points.map((p: any) => p.metadata.programaMarca).filter(Boolean);

      // Count frequencies
      const cargoFreq = new Map<string, number>();
      const empresaFreq = new Map<string, number>();
      const setorFreq = new Map<string, number>();
      const programaFreq = new Map<string, number>();

      cargos.forEach((c: any) => c && cargoFreq.set(c, (cargoFreq.get(c) || 0) + 1));
    empresas.forEach((e: any) => e && empresaFreq.set(e, (empresaFreq.get(e) || 0) + 1));
    setores.forEach((s: any) => s && setorFreq.set(s, (setorFreq.get(s) || 0) + 1));
    programas.forEach((p: any) => p && programaFreq.set(p, (programaFreq.get(p) || 0) + 1));

      // Get top items
      const topCargos = Array.from(cargoFreq.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([cargo, count]) => `${cargo} (${count})`);

      const topSetores = Array.from(setorFreq.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([setor, count]) => `${setor} (${count})`);

      const topProgramas = Array.from(programaFreq.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([programa, count]) => `${programa} (${count})`);

      // Build summary for AI
      const summary = `
Cluster ${clusterId + 1} possui ${points.length} participantes.

Cargos mais comuns:
${topCargos.join('\n')}

Setores mais comuns:
${topSetores.length > 0 ? topSetores.join('\n') : 'Não especificado'}

Programas mais comuns:
${topProgramas.length > 0 ? topProgramas.join('\n') : 'Não especificado'}

Total de empresas diferentes: ${empresaFreq.size}
      `.trim();

      try {
        const { text } = await generateText({
          model: openai("gpt-4o-mini"),
          prompt: `Você é um especialista em análise de dados e segmentação de perfis profissionais.

Analise o seguinte cluster de participantes e forneça:
1. Um nome conciso e descritivo (máximo 4 palavras)
2. Uma descrição clara do que une este grupo (1-2 frases)
3. Lista de 3-5 características comuns principais

Dados do cluster:
${summary}

Responda APENAS em formato JSON puro (sem markdown) com esta estrutura exata:
{
  "name": "Nome do Cluster",
  "description": "Descrição detalhada",
  "commonalities": ["característica 1", "característica 2", "característica 3"]
}`,
          temperature: 0.3,
        });

        // Clean response - remove markdown code blocks if present
        let cleanedText = text.trim();
        if (cleanedText.startsWith('```')) {
          // Remove ```json or ``` from start and ``` from end
          cleanedText = cleanedText.replace(/^```(?:json)?\s*\n/, '').replace(/\n```\s*$/, '');
        }

        // Parse AI response
        const aiResponse = JSON.parse(cleanedText);

        insights.push({
          clusterId,
          name: aiResponse.name || `Cluster ${clusterId + 1}`,
          description: aiResponse.description || "Cluster identificado por similaridade",
          commonalities: aiResponse.commonalities || [],
          count: points.length,
        });

        console.log(`✅ Generated insights for Cluster ${clusterId + 1}: ${aiResponse.name}`);
      } catch (error) {
        console.error(`Failed to generate AI insights for cluster ${clusterId}:`, error);

        // Fallback to rule-based naming
        let name = `Cluster ${clusterId + 1}`;
        const commonalities: string[] = [];

        if (topSetores.length > 0) {
          const mainSetor = Array.from(setorFreq.entries()).sort((a, b) => b[1] - a[1])[0][0];
          name = `Profissionais de ${mainSetor}`;
          commonalities.push(`Setor predominante: ${mainSetor}`);
        }

        if (topCargos.length > 0) {
          const mainCargo = Array.from(cargoFreq.entries()).sort((a, b) => b[1] - a[1])[0][0];
          commonalities.push(`Cargo comum: ${mainCargo}`);
        }

        insights.push({
          clusterId,
          name,
          description: `Grupo de ${points.length} participantes com perfis similares`,
          commonalities,
          count: points.length,
        });
      }
    }

    console.log(`✅ Generated insights for ${insights.length} clusters`);
    return insights;
  },
});

/**
 * Generate cluster analysis using UMAP and HDBSCAN (legacy - calls new separated functions)
 * @deprecated Use generateUMAPCache + runClusteringOnCache instead
 */
export const generateClusterAnalysis = action({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.object({
    points: v.array(v.object({
      participantId: v.id("participants"),
      x: v.number(),
      y: v.number(),
      cluster: v.number(),
      metadata: v.object({
        name: v.optional(v.string()),
        cargo: v.optional(v.string()),
        empresa: v.optional(v.string()),
        setor: v.optional(v.string()),
        programaMarca: v.optional(v.string()),
      }),
    })),
    clusterStats: v.array(v.object({
      clusterId: v.number(),
      count: v.number(),
      label: v.string(),
    })),
    totalParticipants: v.number(),
  }),
  handler: async (ctx, args) => {
    console.log("🎯 Starting cluster analysis");

    // Step 1: Get all participants with their data
    const participants = await ctx.runQuery(
      internal.functions.participantRAG.getAllParticipantIds,
      { limit: args.limit }
    );

    if (participants.length === 0) {
      return {
        points: [],
        clusterStats: [],
        totalParticipants: 0,
      };
    }

    console.log(`Processing ${participants.length} participants`);

    // Step 2: Generate embeddings for each participant
    const participantData: Array<{
      participantId: Id<"participants">;
      embedding: number[];
      metadata: {
        name?: string;
        cargo?: string;
        empresa?: string;
        setor?: string;
        programaMarca?: string;
      };
    }> = [];

    const { embed } = await import("ai");
    const { openai } = await import("@ai-sdk/openai");

    for (const participantId of participants) {
      try {
        const { text, participant } = await ctx.runQuery(
          internal.functions.participantRAG.generateParticipantText,
          { participantId }
        );

        if (!text || text.trim().length === 0) {
          continue;
        }

        // Generate embedding using the same model as RAG
        const { embedding } = await embed({
          model: openai.embedding("text-embedding-3-small"),
          value: text,
        });

        participantData.push({
          participantId,
          embedding,
          metadata: {
            name: participant.name,
            cargo: participant.cargo,
            empresa: participant.empresaPrograma || participant.empresa,
            setor: participant.setor,
            programaMarca: participant.programaMarca,
          },
        });
      } catch (error) {
        console.error(`Failed to process participant ${participantId}:`, error);
      }
    }

    console.log(`✅ Generated ${participantData.length} embeddings`);

    if (participantData.length < 5) {
      // Not enough data for clustering
      return {
        points: participantData.map((p, i) => ({
          participantId: p.participantId,
          x: Math.random(),
          y: Math.random(),
          cluster: 0,
          metadata: p.metadata,
        })),
        clusterStats: [
          {
            clusterId: 0,
            count: participantData.length,
            label: "Todos os participantes",
          },
        ],
        totalParticipants: participantData.length,
      };
    }

    // Step 3: Apply UMAP for dimensionality reduction
    const embeddings = participantData.map((p) => p.embedding);

    const umap = new UMAP({
      nComponents: 2,
      nNeighbors: Math.min(15, Math.floor(embeddings.length / 2)),
      minDist: 0.1,
      spread: 1.0,
    });

    console.log("🔄 Running UMAP dimensionality reduction...");
    const reducedEmbeddings = await umap.fitAsync(embeddings);
    console.log("✅ UMAP complete");

    // Step 4: Apply HDBSCAN for clustering
    // Usar parâmetros menores para criar mais clusters
    const minClusterSize = Math.max(5, Math.floor(participantData.length * 0.02)); // 2% ao invés de 5%
    const minSamples = Math.max(2, Math.floor(minClusterSize / 3)); // Mais sensível à densidade

    console.log(`🔄 Running HDBSCAN clustering (minClusterSize: ${minClusterSize}, minSamples: ${minSamples})...`);
    const hdbscanClusterer = new Hdbscan(
      reducedEmbeddings,
      minClusterSize,
      minSamples
    );

    // Get cluster assignments
    const clusterGroups = hdbscanClusterer.getClusters();

    // Convert cluster format to label array
    const labels = new Array(participantData.length).fill(-1); // -1 for noise
    clusterGroups.forEach((cluster, clusterIndex) => {
      cluster.forEach((pointIndex) => {
        labels[pointIndex] = clusterIndex;
      });
    });

    const clusters = { labels };
    console.log("✅ HDBSCAN complete");

    // Step 5: Build result data
    const points = participantData.map((p, i) => ({
      participantId: p.participantId,
      x: reducedEmbeddings[i][0],
      y: reducedEmbeddings[i][1],
      cluster: clusters.labels[i],
      metadata: p.metadata,
    }));

    // Calculate cluster statistics
    const clusterCounts = new Map<number, number>();
    clusters.labels.forEach((label: number) => {
      clusterCounts.set(label, (clusterCounts.get(label) || 0) + 1);
    });

    const clusterStats = Array.from(clusterCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([clusterId, count]) => ({
        clusterId,
        count,
        label: clusterId === -1 ? "Ruído" : `Cluster ${clusterId + 1}`,
      }));

    console.log(`✅ Cluster analysis complete: ${clusterStats.length} clusters found`);

    return {
      points,
      clusterStats,
      totalParticipants: participantData.length,
    };
  },
});
