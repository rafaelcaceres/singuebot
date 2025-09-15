import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery, query } from "../_generated/server";
import { internal, api } from "../_generated/api";
import { InterviewStage, StateSnapshot } from "../../src/types/interview";

// Interview Stage Configuration
const INTERVIEW_STAGES: Record<InterviewStage, {
  name: string;
  description: string;
  nextStage?: InterviewStage;
  requirements?: string[];
  prompt?: string;
}> = {
  intro: {
    name: "Introdução",
    description: "Apresentação inicial e coleta de consentimento",
    nextStage: "ASA",
    prompt: "Olá! Bem-vindo ao Future in Black. Vamos começar uma conversa sobre sua jornada profissional. Você aceita participar desta entrevista?",
  },
  ASA: {
    name: "ASA - Ancestralidade, Sabedoria, Ascensão", 
    description: "Exploração dos pilares ASA",
    nextStage: "listas",
    prompt: "Vamos explorar sua jornada através dos pilares ASA. Qual aspecto da sua ancestralidade mais influencia suas decisões profissionais?",
  },
  listas: {
    name: "Listas e Mapeamento",
    description: "Coleta de informações estruturadas",
    nextStage: "pre_evento",
    prompt: "Agora vamos criar algumas listas. Quais são suas 3 principais habilidades profissionais?",
  },
  pre_evento: {
    name: "Pré-evento",
    description: "Preparação para o evento principal",
    nextStage: "diaD", 
    prompt: "Estamos nos aproximando do evento. Como você gostaria de se preparar para maximizar essa oportunidade?",
  },
  diaD: {
    name: "Dia D",
    description: "Dia do evento principal",
    nextStage: "pos_24h",
    prompt: "É o grande dia! Como está se sentindo e o que espera alcançar hoje?",
  },
  pos_24h: {
    name: "Pós 24h",
    description: "Reflexão imediata pós-evento",
    nextStage: "pos_7d",
    prompt: "Como foi a experiência ontem? Quais foram os pontos altos?",
  },
  pos_7d: {
    name: "Pós 7 dias", 
    description: "Reflexão após uma semana",
    nextStage: "pos_30d",
    prompt: "Uma semana depois, como você está aplicando o que aprendeu?",
  },
  pos_30d: {
    name: "Pós 30 dias",
    description: "Avaliação final após um mês",
    prompt: "Um mês depois, que mudanças concretas você implementou em sua jornada?",
  },
};

/**
 * Start or resume an interview session
 */
export const startOrResumeSession = internalQuery({
  args: {
    participantId: v.id("participants"),
  },
  returns: v.union(
    v.object({
      _id: v.id("interview_sessions"),
      participantId: v.id("participants"),
      step: v.string(),
      answers: v.any(),
      lastStepAt: v.number(),
      _creationTime: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    // Check if session exists
    const session = await ctx.db
      .query("interview_sessions")
      .withIndex("by_participant", q => q.eq("participantId", args.participantId))
      .unique();

    return session;
  },
});

/**
 * Handle inbound message and progress interview
 */
export const handleInbound = internalAction({
  args: {
    participantId: v.id("participants"),
    text: v.string(),
    messageId: v.string(),
  },
  returns: v.object({
    response: v.string(),
    nextStage: v.union(v.string(), v.null()),
    contextUsed: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    try {
      console.log(`🎙️ Interview: Processing message from participant ${args.participantId}`);

      // Get or create session using internal functions
      let session = await ctx.runQuery(internal.functions.interview.startOrResumeSession, {
        participantId: args.participantId,
      });

      // Create session if doesn't exist
      if (!session) {
        const sessionId = await ctx.runMutation(internal.functions.interview.createSession, {
          participantId: args.participantId,
        });
        
        // Re-fetch the created session
        session = await ctx.runQuery(internal.functions.interview.startOrResumeSession, {
          participantId: args.participantId,
        });
      }

      if (!session) {
        throw new Error("Failed to create or retrieve session");
      }

      console.log(`🎙️ Interview: Current stage: ${session.step}`);

      // Determine if RAG is needed for this stage
      const needsRAG = shouldUseRAG(session.step as InterviewStage, args.text);
      
      let ragContext = null;
      if (needsRAG) {
        console.log("🧠 Interview: Retrieving RAG context");
        try {
          ragContext = await ctx.runAction(internal.functions.rag_actions.retrieve, {
            query: args.text,
            topK: 4,
          });
        } catch (error) {
          console.warn("🧠 Interview: RAG retrieval failed, continuing without context:", error);
        }
      }

      // Generate response using RAG if needed
      const response = await generateInterviewResponse(
        ctx,
        session,
        args.text,
        ragContext
      );

      // Update session with user response
      const updatedAnswers = { ...session.answers };
      updatedAnswers[session.step] = args.text;

      // Determine next step
      const nextStage = determineNextStep(session.step as InterviewStage, args.text);
      
      // Create state snapshot (NEVER exposed to user)
      const stateSnapshot: StateSnapshot = {
        stage: session.step as InterviewStage,
        responses: updatedAnswers,
        nextActions: nextStage ? [nextStage] : [],
        contextUsed: ragContext?.map((r: any) => r.docTitle) || [],
        lastUpdated: Date.now(),
      };

      // Update session
      await ctx.runMutation(internal.functions.interview.updateSession, {
        sessionId: session._id,
        step: nextStage || session.step,
        answers: updatedAnswers,
      });

      // Store message with state snapshot for admin debugging
      await ctx.runMutation(internal.functions.interview.storeInterviewMessage, {
        participantId: args.participantId,
        messageId: args.messageId,
        stateSnapshot,
      });

      console.log(`🎙️ Interview: Generated response for stage ${session.step}`);
      return {
        response: response.text,
        nextStage,
        contextUsed: response.contextUsed || [],
      };

    } catch (error) {
      console.error("🎙️ Interview: Error handling inbound message:", error);
      
      // Fallback response
      return {
        response: "Obrigado por compartilhar. Vou processar sua resposta e voltarei em breve com a próxima etapa. 😊",
        nextStage: null,
        contextUsed: [],
      };
    }
  },
});

/**
 * Generate contextual interview response
 */
async function generateInterviewResponse(
  ctx: any,
  session: any,
  userText: string,
  ragContext?: any[]
): Promise<{text: string, contextUsed?: string[]}> {
  
  const currentStage = session.step as InterviewStage;
  const stageConfig = INTERVIEW_STAGES[currentStage];
  
  // If we have RAG context, use it to enhance the response
  if (ragContext && ragContext.length > 0) {
    try {
      const fusedResponse = await ctx.runAction(internal.functions.rag_actions.fuseAnswer, {
        sessionState: {
          stage: currentStage,
          responses: session.answers,
          step: session.step,
        },
        userText,
        context: ragContext,
      });
      
      return {
        text: fusedResponse.response,
        contextUsed: fusedResponse.contextUsed,
      };
    } catch (error) {
      console.warn("🧠 Interview: RAG fusion failed, using fallback:", error);
    }
  }

  // Fallback to stage-based response
  return {
    text: generateStageResponse(currentStage, userText, session.answers),
  };
}

/**
 * Generate stage-appropriate response without RAG
 */
function generateStageResponse(stage: InterviewStage, userText: string, _answers: any): string {
  
  // Simple rule-based responses (can be enhanced)
  switch (stage) {
    case "intro":
      if (userText.toLowerCase().includes("sim") || userText.toLowerCase().includes("aceito")) {
        return "Perfeito! Vamos começar nossa jornada. " + (INTERVIEW_STAGES.ASA.prompt || "");
      }
      return "Entendo suas preocupações. Esta conversa é confidencial e você pode parar a qualquer momento. Gostaria de continuar?";
    
    case "ASA":
      return `Interessante perspectiva sobre ${userText.split(' ')[0].toLowerCase()}. Como isso se conecta com sua sabedoria pessoal? 🤔`;
    
    case "listas": {
      const skills = userText.match(/\d+/) ? "habilidades" : "pontos";
      return `Ótimas ${skills}! Agora, qual dessas você considera sua maior força? E como planeja desenvolvê-la ainda mais? 💪`;
    }
    
    case "pre_evento":
      return `Excelente estratégia! Que tipo de conexões você espera fazer no evento? Vou te enviar um guia de networking. 🤝`;
    
    case "diaD":
      return `Que energia incrível! Lembre-se: seja autêntico e curioso. Qual sua meta principal para hoje? 🎯`;
    
    case "pos_24h":
      return `Que experiência rica! Dos pontos altos que mencionou, qual teve mais impacto? Como planeja aplicar isso? 💡`;
    
    case "pos_7d":
      return `Parabéns pelo progresso! Que obstáculo encontrou e como superou? Isso mostra sua capacidade de adaptação. 🌱`;
    
    case "pos_30d":
      return `Transformação real acontece com consistência. Seu crescimento é inspirador! Que conselho daria para quem está começando? 🚀`;
    
    default: {
      const stageConfig = INTERVIEW_STAGES[stage as InterviewStage];
      return stageConfig?.prompt || "Obrigado por compartilhar. Como posso te ajudar mais?";
    }
  }
}

/**
 * Determine if RAG should be used for this stage/input
 */
function shouldUseRAG(stage: InterviewStage, text: string): boolean {
  // Use RAG for stages that benefit from contextual knowledge
  const ragStages: InterviewStage[] = ["ASA", "listas", "pre_evento"];
  
  if (!ragStages.includes(stage)) return false;
  
  // Check if user is asking questions or mentioning specific topics
  const questionWords = ["como", "por que", "que", "qual", "quando", "onde"];
  const hasQuestion = questionWords.some(word => text.toLowerCase().includes(word));
  
  const topicWords = ["carreira", "liderança", "empreendedorismo", "networking"];
  const hasTopic = topicWords.some(word => text.toLowerCase().includes(word));
  
  return hasQuestion || hasTopic || text.length > 50; // Longer responses likely need context
}

/**
 * Determine next interview step
 */
function determineNextStep(currentStage: InterviewStage, userResponse: string): InterviewStage | null {
  const stageConfig = INTERVIEW_STAGES[currentStage];
  
  // Simple progression logic (can be enhanced with NLP)
  if (currentStage === "intro") {
    // Only progress if user gives consent
    if (userResponse.toLowerCase().includes("sim") || 
        userResponse.toLowerCase().includes("aceito") ||
        userResponse.toLowerCase().includes("concordo")) {
      return stageConfig.nextStage || null;
    }
    return null; // Stay in intro until consent
  }
  
  // Progress to next stage if response is substantial
  if (userResponse.length > 10) {
    return stageConfig.nextStage || null;
  }
  
  return null; // Stay in current stage
}

// Internal mutations
export const createSession = internalMutation({
  args: {
    participantId: v.id("participants"),
  },
  returns: v.id("interview_sessions"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("interview_sessions", {
      participantId: args.participantId,
      step: "intro",
      answers: {},
      lastStepAt: Date.now(),
    });
  },
});

export const updateSession = internalMutation({
  args: {
    sessionId: v.id("interview_sessions"),
    step: v.string(),
    answers: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, {
      step: args.step,
      answers: args.answers,
      lastStepAt: Date.now(),
    });
    return null;
  },
});

export const storeInterviewMessage = internalMutation({
  args: {
    participantId: v.id("participants"),
    messageId: v.string(),
    stateSnapshot: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Update the WhatsApp message with state snapshot (for admin debugging only)
    const message = await ctx.db
      .query("whatsappMessages")
      .withIndex("by_message_id", q => q.eq("messageId", args.messageId))
      .unique();
    
    if (message) {
      await ctx.db.patch(message._id, {
        stateSnapshot: args.stateSnapshot,
      });
    }
    return null;
  },
});

// Public queries for admin
export const getParticipantSession = query({
  args: {
    participantId: v.id("participants"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("interview_sessions")
      .withIndex("by_participant", q => q.eq("participantId", args.participantId))
      .unique();
  },
});

export const getSessionsByStage = query({
  args: {
    stage: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    return await ctx.db
      .query("interview_sessions")
      .withIndex("by_step", q => q.eq("step", args.stage))
      .order("desc")
      .take(limit);
  },
});

export const getInterviewStats = query({
  args: {},
  handler: async (ctx) => {
    const sessions = await ctx.db.query("interview_sessions").collect();
    
    const statsByStage = sessions.reduce((acc, session) => {
      acc[session.step] = (acc[session.step] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalSessions = sessions.length;
    const completedSessions = sessions.filter(s => s.step === "pos_30d").length;
    const completionRate = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;

    return {
      totalSessions,
      completedSessions,
      completionRate,
      statsByStage,
    };
  },
});