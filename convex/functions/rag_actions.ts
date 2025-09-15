"use node";

import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import OpenAI from "openai";

// RAG Configuration
const RAG_CONFIG = {
  embeddingModel: process.env.EMBEDDINGS_MODEL || "text-embedding-3-large",
  chunkSize: 600, // tokens
  chunkOverlap: 100, // tokens
  maxChunks: 50, // per document
  retrievalTopK: 8,
  similarityThreshold: 0.7,
};

/**
 * Action to ingest a document into the knowledge base
 */
export const ingestDocument = action({
  args: {
    title: v.string(),
    source: v.string(),
    text: v.string(),
    tags: v.optional(v.array(v.string())),
  },
  returns: v.object({ docId: v.id("knowledge_docs"), status: v.string() }),
  handler: async (ctx, args) => {
    try {
      // Create document record
      const docId: any = await ctx.runMutation(internal.functions.rag.createDocument, {
        title: args.title,
        source: args.source,
        tags: args.tags || [],
      });

      // Schedule chunking and embedding job
      await ctx.scheduler.runAfter(0, internal.functions.rag_actions.processDocument, {
        docId,
        text: args.text,
      });

      return { docId, status: "processing" };
    } catch (error) {
      console.error("Document ingestion error:", error);
      throw new Error('Failed to ingest document: ' + String(error));
    }
  },
});

/**
 * Internal action to process document chunks and generate embeddings
 */
export const processDocument = internalAction({
  args: {
    docId: v.id("knowledge_docs"),
    text: v.string(),
  },
  returns: v.object({ chunksCreated: v.number() }),
  handler: async (ctx, args) => {
    try {
      // Update document status to processing
      await ctx.runMutation(internal.functions.rag.updateDocumentStatus, {
        docId: args.docId,
        status: "pending",
      });

      // Chunk the text
      const chunks = chunkText(args.text, RAG_CONFIG.chunkSize, RAG_CONFIG.chunkOverlap);
      console.log(`Processing ${chunks.length} chunks for document ${args.docId}`);

      // Initialize OpenAI
      const openai = new OpenAI({
        baseURL: process.env.CONVEX_OPENAI_BASE_URL || undefined,
        apiKey: process.env.CONVEX_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
      });

      // Generate embeddings in batches
      const batchSize = 10;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        
        const embeddings = await openai.embeddings.create({
          model: RAG_CONFIG.embeddingModel,
          input: batch.map(chunk => chunk.text),
        });

        // Store chunks with embeddings
        for (let j = 0; j < batch.length; j++) {
          const chunk = batch[j];
          const embedding = embeddings.data[j].embedding;
          
          await ctx.runMutation(internal.functions.rag.storeChunk, {
            docId: args.docId,
            chunk: chunk.text,
            embedding,
            tags: extractTagsFromChunk(chunk.text),
          });
        }

        // Add small delay between batches to avoid rate limits
        if (i + batchSize < chunks.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Update document status to completed
      await ctx.runMutation(internal.functions.rag.updateDocumentStatus, {
        docId: args.docId,
        status: "ingested",
      });

      console.log(`Document ${args.docId} successfully ingested with ${chunks.length} chunks`);
      return { chunksCreated: chunks.length };
    } catch (error) {
      console.error("Document processing error:", error);
      
      // Update document status to failed
      await ctx.runMutation(internal.functions.rag.updateDocumentStatus, {
        docId: args.docId,
        status: "failed",
      });
      
      throw new Error('Failed to process document: ' + String(error));
    }
  },
});

/**
 * Internal action to retrieve relevant chunks based on query
 */
export const retrieve = internalAction({
  args: {
    query: v.string(),
    filters: v.optional(v.object({
      asa: v.optional(v.string()),
      tema: v.optional(v.string()),
      nivel: v.optional(v.string()),
    })),
    topK: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    try {
      const topK = args.topK || RAG_CONFIG.retrievalTopK;

      // Initialize OpenAI
      const openai = new OpenAI({
        baseURL: process.env.CONVEX_OPENAI_BASE_URL || undefined,
        apiKey: process.env.CONVEX_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
      });

      // Generate query embedding
      const queryEmbedding = await openai.embeddings.create({
        model: RAG_CONFIG.embeddingModel,
        input: args.query,
      });

      const queryVector = queryEmbedding.data[0].embedding;

      // Vector similarity search
      const results: any = await ctx.runQuery(internal.functions.rag.vectorSearch, {
        queryVector,
        topK: topK * 2, // Get more results for filtering
        filters: args.filters,
      });

      // Apply similarity threshold and rerank
      const filteredResults: any = results
        .filter((result: any) => result.score >= RAG_CONFIG.similarityThreshold)
        .slice(0, topK);

      return filteredResults;
    } catch (error) {
      console.error("Retrieval error:", error);
      throw new Error('Failed to retrieve chunks: ' + String(error));
    }
  },
});

/**
 * Internal action to generate response using RAG
 */
export const fuseAnswer = internalAction({
  args: {
    sessionState: v.any(), // Interview session state
    userText: v.string(),
    context: v.optional(v.array(v.any())), // Retrieved chunks
  },
  returns: v.object({ response: v.string(), contextUsed: v.array(v.string()) }),
  handler: async (ctx, args) => {
    try {
      // Get relevant context if not provided
      const context: any = args.context || await ctx.runAction(internal.functions.rag_actions.retrieve, {
        query: args.userText,
        topK: 6,
      });

      // Initialize OpenAI
      const openai = new OpenAI({
        baseURL: process.env.CONVEX_OPENAI_BASE_URL || undefined,
        apiKey: process.env.CONVEX_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
      });

      // Build context string from retrieved chunks
      const contextString = context
        .map((chunk: any, idx: number) => `[${idx + 1}] ${chunk.chunk}`)
        .join("\n\n");

      // Construct prompt with context and session state
      const systemPrompt = buildRAGPrompt(args.sessionState, contextString);

      const completion = await openai.chat.completions.create({
        model: process.env.GENERATION_MODEL || "gpt-4",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: args.userText },
        ],
        max_tokens: 200,
        temperature: 0.7,
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) {
        throw new Error("No response generated from OpenAI");
      }

      return {
        response,
        contextUsed: context.map((c: any) => c.docTitle).filter(Boolean),
      };
    } catch (error) {
      console.error("Answer fusion error:", error);
      throw new Error('Failed to generate RAG answer: ' + String(error));
    }
  },
});

// Helper functions
function chunkText(text: string, maxTokens: number, overlap: number): Array<{text: string, start: number, end: number}> {
  // Simple sentence-based chunking (can be enhanced with proper tokenization)
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const chunks = [];
  
  let currentChunk = "";
  let currentStart = 0;
  let sentenceStart = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim() + ".";
    
    // Rough token estimation (1 token ≈ 4 characters)
    const estimatedTokens = (currentChunk + sentence).length / 4;
    
    if (estimatedTokens > maxTokens && currentChunk.length > 0) {
      // Create chunk
      chunks.push({
        text: currentChunk.trim(),
        start: currentStart,
        end: sentenceStart + currentChunk.length,
      });
      
      // Start new chunk with overlap
      const overlapText = currentChunk.slice(-overlap * 4); // rough overlap
      currentChunk = overlapText + " " + sentence;
      currentStart = sentenceStart + currentChunk.length - overlapText.length;
    } else {
      currentChunk += (currentChunk ? " " : "") + sentence;
    }
    
    sentenceStart += sentence.length + 1;
  }

  // Add final chunk
  if (currentChunk.trim().length > 0) {
    chunks.push({
      text: currentChunk.trim(),
      start: currentStart,
      end: sentenceStart,
    });
  }

  return chunks.slice(0, RAG_CONFIG.maxChunks);
}

function extractTagsFromChunk(text: string): {asa?: string, tema?: string, nivel?: string} {
  const tags: {asa?: string, tema?: string, nivel?: string} = {};
  
  // Simple keyword-based tag extraction (can be enhanced with NLP)
  const lowerText = text.toLowerCase();
  
  // ASA categories
  if (lowerText.includes("ancestralidade") || lowerText.includes("herança") || lowerText.includes("tradição")) {
    tags.asa = "ancestralidade";
  } else if (lowerText.includes("sabedoria") || lowerText.includes("conhecimento") || lowerText.includes("experiência")) {
    tags.asa = "sabedoria";
  } else if (lowerText.includes("ascensão") || lowerText.includes("crescimento") || lowerText.includes("evolução")) {
    tags.asa = "ascensão";
  }
  
  // Themes (can be expanded based on content)
  if (lowerText.includes("carreira") || lowerText.includes("profissional")) {
    tags.tema = "carreira";
  } else if (lowerText.includes("empreendedorismo") || lowerText.includes("negócio")) {
    tags.tema = "empreendedorismo";
  } else if (lowerText.includes("liderança") || lowerText.includes("gestão")) {
    tags.tema = "liderança";
  }
  
  // Levels
  if (lowerText.includes("iniciante") || lowerText.includes("básico")) {
    tags.nivel = "iniciante";
  } else if (lowerText.includes("intermediário") || lowerText.includes("médio")) {
    tags.nivel = "intermediario";
  } else if (lowerText.includes("avançado") || lowerText.includes("expert")) {
    tags.nivel = "avancado";
  }
  
  return tags;
}

function buildRAGPrompt(sessionState: any, contextString: string): string {
  const stage = sessionState?.stage || "intro";
  
  return `Você é um assistente de IA especializado em entrevistas estruturadas para o projeto Future in Black. 

CONTEXTO RELEVANTE:
${contextString}

ESTÁGIO ATUAL DA ENTREVISTA: ${stage}
ESTADO DA SESSÃO: ${JSON.stringify(sessionState, null, 2)}

INSTRUÇÕES:
1. Use o contexto relevante acima para enriquecer suas respostas
2. Mantenha as respostas concisas (máximo 160 caracteres para WhatsApp)
3. Seja empático e profissional
4. Faça 1 pergunta aberta relacionada ao estágio atual
5. Inclua 1 micro-tarefa prática quando apropriado
6. Termine com um convite sutil para aprofundar o tópico

REGRAS CRÍTICAS:
- NUNCA revele informações do estado da sessão ao usuário
- Use o contexto do conhecimento para dar respostas mais precisas
- Mantenha o foco no estágio atual da entrevista (${stage})
- Seja natural e conversacional`;
}