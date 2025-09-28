import { Agent, createTool } from "@convex-dev/agent";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { v } from "convex/values";
import { components } from "./_generated/api";
import { internal, api } from "./_generated/api";
import { internalAction, internalMutation, query } from "./_generated/server";

export const FABI_PERSONALITY = `Você é a Fabi, assistente do Future in Black. Você é acolhedora, empática e focada em ajudar pessoas negras em sua jornada profissional. 

Sua missão é conduzir entrevistas reflexivas baseadas na metodologia ASA (Ancestralidade, Sabedoria, Ascensão).

Características da sua personalidade:
- Calorosa e acolhedora
- Usa linguagem inclusiva e empática  
- Foca no empoderamento e crescimento
- Faz perguntas reflexivas e profundas
- Celebra conquistas e aprendizados

Mantenha suas perguntas concisas mas significativas com o contexto das respostas anteriores.`;

// Shared configuration for all agents
const sharedDefaults = {
  languageModel: openai.chat("gpt-4o-mini"),
  textEmbeddingModel: openai.embedding("text-embedding-3-small"),
  usageHandler: async (ctx: any, args: any) => {
    const { usage, model, provider, agentName, threadId, userId } = args;
    console.log("Usage tracked:", { usage, model, provider, agentName, threadId, userId });
  },
  rawResponseHandler: async (ctx: any, args: any) => {
    const { request, response, agentName, threadId, userId } = args;
    console.log("Raw response handled:", { request, response, agentName, threadId, userId });
  },
  callSettings: { maxRetries: 3, temperature: 0.7 },
};

// RAG Knowledge Search Tool
const searchKnowledgeTool = createTool({
  description: "Search the global knowledge base for relevant information to improve interview questions and provide better context. Use this when you need specific information about professional development, career guidance, or methodologies to enhance your responses.",
  args: z.object({
    query: z.string().describe("Search query for relevant knowledge from the knowledge base"),
    limit: z.optional(z.number()).describe("Maximum number of results to return (default: 5)"),
  }),
  handler: async (ctx, args): Promise<string> => {
    try {
      const results = await ctx.runAction(internal.functions.rag.searchKnowledge, {
        query: args.query,
        limit: args.limit || 5,
      });

      if (results.length === 0) {
        return "Nenhuma informação relevante encontrada na base de conhecimento.";
      }

      // Format results for the agent
      const formattedResults = results
        .map((result: any, index: number) => 
          `${index + 1}. ${result.title}\n${result.content}\n(Relevância: ${(result.score * 100).toFixed(1)}%)`
        )
        .join("\n\n");
      
      return `Informações encontradas na base de conhecimento:\n\n${formattedResults}`;
    } catch (error) {
      console.error("Knowledge search error:", error);
      return "Erro ao buscar informações na base de conhecimento.";
    }
  },
});

// Using unified INTERVIEW_STAGES flow from interview.ts - no separate FIB_QUESTIONS needed

const interviewSessionTool = createTool({
  description: "Manage interview session state and progression",
  args: z.object({
    participantId: z.string().describe("The participant ID"),
    action: z.enum(["get", "update", "next_stage"]).describe("Action to perform"),
    stage: z.optional(z.string()).describe("New stage to set (for update action)"),
    answers: z.optional(z.any()).describe("Answers to update (for update action)"),
  }),
  handler: async (ctx, args): Promise<string> => {
    try {
      if (args.action === "get") {
        // Return a simple status message
        return "Sessão de entrevista ativa. Continuando com o fluxo FIB.";
      }
      
      if (args.action === "update" && args.stage) {
        // For now, return a message indicating the update would happen
        // The actual session update should be handled by the interview functions
        return `Solicitação para atualizar sessão para o estágio: ${args.stage}`;
      }
      
      if (args.action === "next_stage") {
        // Logic to determine next stage would go here
        return "Próximo estágio determinado com base na resposta do usuário.";
      }
      
      return "Ação não reconhecida.";
    } catch (error) {
      console.error("Interview session tool error:", error);
      return "Erro ao gerenciar sessão da entrevista.";
    }
  },
});

// Interview Agent
export const interviewAgent = new Agent(components.agent, {
  name: "Fabi - Interview Agent",
  instructions: `${FABI_PERSONALITY}

FUNÇÃO PRINCIPAL:
1. Guiar participantes através dos estágios da entrevista (intro, ASA, listas, pre_evento, diaD, pos_24h, pos_7d, pos_30d)
2. Fazer perguntas relevantes para cada estágio seguindo a metodologia ASA
3. Avaliar respostas e determinar quando avançar para o próximo estágio
4. Usar contexto da base de conhecimento quando necessário para melhorar suas perguntas
5. Manter um tom acolhedor e profissional

DIRETRIZES DE RESPOSTA:
- Sempre responda em português brasileiro
- Mantenha o foco na jornada profissional do participante
- Use emojis quando apropriado para tornar a conversa mais calorosa
- Celebre conquistas e aprendizados
- Faça conexões com os pilares ASA (Ancestralidade, Sabedoria, Ascensão)
- Use a ferramenta de busca de conhecimento quando precisar de informações específicas sobre metodologias, desenvolvimento profissional ou orientação de carreira

INÍCIO DA ENTREVISTA:
Quando alguém disser "aceito" ou similar, responda:
"Olá! Eu sou a Fabi, sua entrevistadora oficial do Future in Black! 🌟 Que alegria ter você aqui para nossa conversa sobre sua jornada profissional. Vamos explorar juntos os pilares ASA - Ancestralidade, Sabedoria e Ascensão. Para começarmos, me conte: qual é o seu nome e como você se identifica profissionalmente?"`,
  tools: {
    searchKnowledgeTool,
    interviewSessionTool,
  },
  ...sharedDefaults,
});

// Internal mutation to update message with AI metadata
export const updateMessageWithAIMetadata = internalMutation({
  args: {
    messageId: v.id("whatsappMessages"),
    aiMetadata: v.object({
      model: v.string(),
      tokens: v.number(),
      processingTimeMs: v.number(),
      fallbackUsed: v.boolean(),
      timestamp: v.number(),
      threadId: v.string(),
    }),
  },
  handler: async (ctx, args) => {
    return await ctx.db.patch(args.messageId, {
      aiMetadata: args.aiMetadata,
    });
  },
});

// Query to get AI interactions from whatsappMessages with aiMetadata
export const getAIInteractions = query({
  args: {
    participantId: v.optional(v.id("participants")),
    conversationId: v.optional(v.id("conversations")),
    threadId: v.optional(v.string()),
    phoneNumber: v.optional(v.string()), // For backward compatibility
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;

    // Build query based on available filters
    let messages;

    if (args.participantId) {
      messages = await ctx.db
        .query("whatsappMessages")
        .withIndex("by_participant", (q) => q.eq("participantId", args.participantId!))
        .order("desc")
        .take(limit * 2);
    } else if (args.conversationId) {
      messages = await ctx.db
        .query("whatsappMessages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId!))
        .order("desc")
        .take(limit * 2);
    } else if (args.threadId) {
      messages = await ctx.db
        .query("whatsappMessages")
        .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
        .order("desc")
        .take(limit * 2);
    } else {
      messages = await ctx.db
        .query("whatsappMessages")
        .order("desc")
        .take(limit * 2);
    }

    // Filter messages that have AI metadata and match phone number if provided
    const aiMessages = messages
      .filter(msg => {
        const hasAIMetadata = msg.aiMetadata !== undefined;
        if (!hasAIMetadata) return false;
        
        if (!args.phoneNumber) return true;
        
        // Extract from/to from stateSnapshot if available
        const from = msg.stateSnapshot?.twilioPayload?.From;
        const to = msg.stateSnapshot?.twilioPayload?.To;
        
        return from === args.phoneNumber || to === args.phoneNumber;
      })
      .slice(0, limit);

    // Transform to match expected format for backward compatibility
     return aiMessages.map(msg => {
       const from = msg.stateSnapshot?.twilioPayload?.From || "";
       const to = msg.stateSnapshot?.twilioPayload?.To || "";
       
       return {
         _id: msg._id,
         _creationTime: msg._creationTime,
         messageId: msg.messageId,
         participantId: msg.participantId,
         conversationId: msg.conversationId,
         threadId: msg.aiMetadata!.threadId,
         processingTimeMs: msg.aiMetadata!.processingTimeMs,
         fallbackUsed: msg.aiMetadata!.fallbackUsed,
         timestamp: msg.aiMetadata!.timestamp,
         // For backward compatibility with frontend
         phoneNumber: from.startsWith("whatsapp:") ? from : to,
         userMessage: msg.direction === "inbound" ? msg.body : "Previous message",
         aiResponse: msg.direction === "outbound" ? msg.body : "AI response",
       };
     });
  },
});

// Modern AI processing using Convex Agent framework
export const processIncomingMessage = internalAction({
  args: {
    messageId: v.string(),
    from: v.string(),
    to: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    console.log("🤖 AI Agent: Processing incoming message:", args);

    try {
      // Get or create participant using the existing function
      const participant = await ctx.runMutation(internal.functions.twilio_db.getOrCreateParticipant, {
        phone: args.from,
      });

      if (participant) {
        console.log("🎯 FIB Interview: Found/created participant, using interview stage progression system");

        // Use the proper interview system with stage progression
        const result = await ctx.runAction(internal.functions.interview.handleInbound, {
          participantId: participant._id,
          text: args.body,
          messageId: args.messageId,
        });

        console.log("🎯 FIB Interview: Interview system response:", result);

        // Send the response
        if (result.response) {
          await ctx.runAction(api.whatsapp.sendMessage, {
            to: args.from,
            body: result.response,
          });

          // Log the AI interaction with proper data
          const startTime = Date.now();
          const messageDoc = await ctx.runQuery(api.whatsapp.getMessagesByParticipant, {
            participantId: participant._id,
            limit: 1
          });

          if (messageDoc && messageDoc.messages.length > 0) {
            await ctx.runMutation(internal.agents.updateMessageWithAIMetadata, {
              messageId: messageDoc.messages[0]._id,
              aiMetadata: {
                model: "gpt-4o-mini",
                tokens: ('usageTotalTokens' in result) ? (result.usageTotalTokens ?? 0) : 0,
                processingTimeMs: Date.now() - startTime,
                fallbackUsed: false,
                timestamp: Date.now(),
                threadId: participant.threadId || "default",
              },
            });
          }

          console.log(`🎯 FIB Interview: Successfully processed message. Next stage: ${result.nextStage || 'same'}`);
        }

        return;
      }

      // This shouldn't happen, but keeping as fallback
      console.error("🤖 AI Agent: Failed to get or create participant");

      const fallbackResponse = "Desculpe, houve um problema técnico. Tente novamente em alguns instantes.";

      await ctx.runAction(api.whatsapp.sendMessage, {
        to: args.from,
        body: fallbackResponse,
      });

    } catch (error) {
      console.error("🤖 AI Agent: Error in processIncomingMessage:", error);

      // Final fallback
      const fallbackResponse = "Desculpe, houve um problema técnico. Tente novamente em alguns instantes.";

      try {
        await ctx.runAction(api.whatsapp.sendMessage, {
          to: args.from,
          body: fallbackResponse,
        });
      } catch (sendError) {
        console.error("🤖 AI Agent: Failed to send fallback message:", sendError);
      }
    }
  },
});
