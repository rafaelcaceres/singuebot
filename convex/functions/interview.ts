import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery, query } from "../_generated/server";
import { internal } from "../_generated/api";
import { InterviewStage, StateSnapshot } from "../../src/types/interview";
import { interviewAgent } from "../agents";
import type { Thread } from "@convex-dev/agent";

// Utility Functions
/**
 * Creates standardized error response for interview operations
 */
const createInterviewErrorResponse = (error: any, fallbackMessage: string) => {
  console.error("🚨 Interview Error:", error);
  return {
    response: fallbackMessage,
    nextStage: null,
    contextUsed: [],
  };
};

/**
 * Handles fallback responses with consistent logging
 */
const handleFallbackResponse = async (
  ctx: any,
  stageConfig: any,
  messageId: string,
  userText: string,
  participantPhone: string,
  usePromptAsFallback = false
): Promise<string> => {
  const fallbackResponse = usePromptAsFallback 
    ? (stageConfig?.prompt || "Obrigado por compartilhar. Como posso te ajudar mais?")
    : (stageConfig?.fallbackMessage || "Obrigado por compartilhar. Como posso te ajudar mais?");
  
  return fallbackResponse;
};

/**
 * Gets or creates a thread for the participant
 */
const getOrCreateThread = async (
  ctx: any,
  participantId: string,
  existingThread?: Thread<{ interviewSessionTool: any }>
): Promise<Thread<{ interviewSessionTool: any }>> => {

  if (existingThread) return existingThread;

  const participant = await ctx.runQuery(internal.functions.twilio_db.getParticipant, {
    participantId: participantId,
  });
  
  if (participant?.threadId) {
    try {
      const { thread } = await interviewAgent.continueThread(ctx, { threadId: participant.threadId });
      if (thread) {
        return thread;
      }
    } catch (error) {
      console.warn(`Failed to retrieve existing thread ${participant.threadId} for participant ${participantId}:`, error);
    }
  }

  const { thread } = await interviewAgent.createThread(ctx, { 
    userId: participantId 
  });

  await ctx.runMutation(internal.functions.twilio_db.updateParticipantThreadId, {
    participantId: participantId,
    threadId: thread.threadId
  });

  return thread;
};

/**
 * Functional helper to get or create a session for a participant
 * Uses immutable patterns and proper error handling
 */
/**
 * Functional helper to get or create session with minimal database calls
 * Uses a more elegant approach with proper error handling
 */
const getOrCreateSession = async (
  ctx: any,
  participantId: string
) => {
  const session = await ctx.runQuery(internal.functions.interview.startOrResumeSession, {
    participantId,
  });

  return session ?? await createAndReturnSession(ctx, participantId);
};

/**
 * Creates a new session and returns it with proper type safety
 * Encapsulates the creation logic in a pure function
 */
const createAndReturnSession = async (ctx: any, participantId: string) => {
  const sessionId = await ctx.runMutation(internal.functions.interview.createSession, {
    participantId,
  });

  // Return the session data directly instead of making another query
  return {
    _id: sessionId,
    participantId,
    step: "intro",
    answers: {},
    lastStepAt: Date.now(),
    _creationTime: Date.now(),
  };
};

/**
 * Functional helper to process session updates immutably
 * Returns updated session and next stage without side effects
 */
const processSessionUpdate = (
  session: {
    _id: string;
    participantId: string;
    step: string;
    answers: any;
    lastStepAt: number;
    _creationTime: number;
  },
  userText: string
): {
  updatedSession: typeof session;
  nextStage: InterviewStage | null;
} => {
  // Create immutable copy with updated answers
  const updatedAnswers = {
    ...session.answers,
    [session.step]: userText,
  };

  // Determine next step based on current stage and user response
  const nextStage = determineNextStep(session.step as InterviewStage, userText);

  // Create updated session with new step if progressing
  const updatedSession = {
    ...session,
    answers: updatedAnswers,
    step: nextStage || session.step,
  };

  return {
    updatedSession,
    nextStage,
  };
};

// Interview Stage Configuration
const INTERVIEW_STAGES: Record<InterviewStage, {
  name: string;
  description: string;
  nextStage?: InterviewStage;
  requirements?: string[];
  prompt?: string;
  fallbackMessage?: string;
}> = {
  intro: {
    name: "Introdução",
    description: "Apresentação inicial e coleta de consentimento",
    nextStage: "ASA",
    prompt: "Você está no estágio de introdução. Apresente-se como Fabi do Future in Black de forma calorosa e acolhedora. Explique brevemente que vocês terão uma conversa sobre a jornada profissional da pessoa baseada na metodologia ASA (Ancestralidade, Sabedoria, Ascensão). Pergunte se a pessoa aceita participar desta entrevista reflexiva. Mantenha o tom empático e use emojis apropriados. Vá para o proximo estagio se ele aceitar",
    fallbackMessage: "Olá! 👋 Sou a Fabi do Future in Black. Que bom ter você aqui! Gostaria de ter uma conversa sobre sua jornada profissional usando nossa metodologia ASA. Você aceita participar? 😊",
  },
  ASA: {
    name: "ASA - Ancestralidade, Sabedoria, Ascensão", 
    description: "Exploração dos pilares ASA",
    nextStage: "listas",
    prompt: "Você está explorando os pilares ASA com o participante. Faça perguntas reflexivas sobre como a ancestralidade da pessoa influencia suas decisões profissionais. Explore conceitos como pensamento sistêmico, impactos da opressão, e conexões com suas raízes. Avalie se as respostas demonstram reflexão profunda sobre esses temas. Só avance para o próximo estágio quando obtiver respostas substanciais que mostrem autoconhecimento sobre a influência da ancestralidade na vida profissional. Se as respostas forem superficiais, faça perguntas de aprofundamento.",
    fallbackMessage: "Vamos explorar como sua ancestralidade influencia suas decisões profissionais. Como você vê a conexão entre suas raízes e sua trajetória de carreira? 🌱",
  },
  listas: {
    name: "Listas e Mapeamento",
    description: "Coleta de informações estruturadas",
    nextStage: "pre_evento",
    prompt: "Agora você está coletando informações estruturadas. Peça para o participante listar suas 3 principais habilidades profissionais. Depois, explore cada habilidade perguntando como ela se conecta com os pilares ASA discutidos anteriormente. Ajude a pessoa a fazer conexões entre suas competências e sua identidade ancestral. Celebre as conquistas mencionadas. Avalie se a resposta faz sentido e então termine a entrevista, avisando que em breve entraremos em contato novamente!.",
    fallbackMessage: "Agora vamos mapear suas habilidades! Pode me contar quais são suas 3 principais competências profissionais? 📝✨",
  },
  pre_evento: {
    name: "Pré-evento",
    description: "Preparação para o evento principal",
    nextStage: "diaD", 
    prompt: "Você está preparando o participante para um evento importante. Pergunte sobre suas expectativas, ansiedades e como planeja se preparar. Conecte a preparação com os aprendizados dos pilares ASA. Ofereça encorajamento e ajude a pessoa a visualizar o sucesso, lembrando-a de suas forças ancestrais e habilidades identificadas.",
    fallbackMessage: "Como você está se sentindo sobre o evento que se aproxima? Quais são suas expectativas e como posso te ajudar na preparação? 🚀",
  },
  diaD: {
    name: "Dia D",
    description: "Dia do evento principal",
    nextStage: "pos_24h",
    prompt: "É o dia do evento! Pergunte como a pessoa está se sentindo e o que espera alcançar. Relembre brevemente as forças e preparações discutidas. Ofereça palavras de encorajamento conectadas aos pilares ASA. Mantenha o tom motivacional e empoderador.",
    fallbackMessage: "É hoje! 🎉 Como você está se sentindo? Lembre-se de todas as suas forças que conversamos. Você está preparado(a)! 💪",
  },
  pos_24h: {
    name: "Pós 24h",
    description: "Reflexão imediata pós-evento",
    nextStage: "pos_7d",
    prompt: "Faça uma reflexão imediata sobre a experiência do evento. Pergunte sobre os pontos altos, desafios enfrentados, e como a pessoa se sentiu. Conecte as experiências com os pilares ASA e celebre as conquistas. Ajude a identificar aprendizados importantes desta experiência.",
    fallbackMessage: "Como foi a experiência? Conte-me sobre os pontos altos e os desafios que enfrentou. Como você se sentiu? 🌟",
  },
  pos_7d: {
    name: "Pós 7 dias", 
    description: "Reflexão após uma semana",
    nextStage: "pos_30d",
    prompt: "Uma semana se passou. Pergunte como a pessoa está processando a experiência e que insights surgiram com o tempo. Explore como ela está aplicando os aprendizados no dia a dia profissional. Conecte com os pilares ASA e reforce o crescimento observado.",
    fallbackMessage: "Uma semana se passou! Como você está processando tudo que viveu? Que insights surgiram com o tempo? 💭",
  },
  pos_30d: {
    name: "Pós 30 dias",
    description: "Avaliação final após um mês",
    prompt: "Este é o momento de avaliação final após um mês. Pergunte sobre mudanças concretas implementadas na jornada profissional. Explore como a metodologia ASA tem influenciado decisões e perspectivas. Celebre o crescimento e a jornada percorrida. Ofereça palavras de encorajamento para a continuidade do desenvolvimento profissional.",
    fallbackMessage: "Um mês depois! Que mudanças você implementou em sua jornada profissional? Como nossa conversa tem influenciado suas decisões? 🌈",
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
    usageTotalTokens: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    try {
      console.log(`🎙️ Interview: Processing message from participant ${args.participantId}`);

      // Get participant data to access phone number
      const participant = await ctx.runQuery(internal.functions.twilio_db.getParticipant, {
        participantId: args.participantId,
      });

      if (!participant) {
        throw new Error("Participant not found");
      }

      // Get or create session using functional approach
      const session = await getOrCreateSession(ctx, args.participantId);

      console.log(`🎙️ Interview: Current stage: ${session.step}`);

      // Process session update using functional approach
      const { updatedSession, nextStage } = processSessionUpdate(session, args.text);

      // Update session in database if there's a stage progression
      if (nextStage) {
        await ctx.runMutation(internal.functions.interview.updateSession, {
          sessionId: session._id,
          step: nextStage,
          answers: updatedSession.answers,
        });
      }

      // Create or get existing thread for this participant to maintain conversation continuity
      const thread = await getOrCreateThread(ctx, args.participantId);

      // Generate response using the updated session state
      const response = await generateInterviewResponse(
        ctx,
        updatedSession,
        args.text,
        args.messageId,
        participant.phone,
        args.participantId,
        thread,
      );

      // Store state snapshot for debugging and analytics
      const stateSnapshot: StateSnapshot = {
        stage: session.step as InterviewStage,
        responses: updatedSession.answers,
        nextActions: nextStage ? [nextStage] : [],
        contextUsed: response.contextUsed || [],
        lastUpdated: Date.now(),
      };

      // Final session update if we didn't progress stages
      if (!nextStage) {
        await ctx.runMutation(internal.functions.interview.updateSession, {
          sessionId: session._id,
          step: session.step,
          answers: updatedSession.answers,
        });
      }

      await ctx.runMutation(internal.functions.interview.storeInterviewMessage, {
        participantId: args.participantId,
        messageId: args.messageId,
        stateSnapshot,
      });

      console.log(`🎙️ Interview: Generated response for stage ${session.step}`);

      return {
        response: response.text,
        nextStage: nextStage,
        contextUsed: response.contextUsed || [],
        usageTotalTokens: response.usageTotalTokens,
      };

    } catch (error) {
      return createInterviewErrorResponse(
        error, 
        "Desculpe, houve um problema técnico. Pode repetir sua mensagem? 🤔"
      );
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
  messageId: string,
  participantPhone: string,
  participantId: string,
  thread: Thread<{ interviewSessionTool: any }>
): Promise<{
  text: string;
  contextUsed?: string[];
  usageTotalTokens?: number;
}> {
  
  const currentStage = session.step as InterviewStage;
  const stageConfig = INTERVIEW_STAGES[currentStage];
  
  // Generate response using LLM directly - sistema focado apenas em entrevistas
  try {
    const llmResponse = await generateLLMInterviewResponse(
      ctx,
      currentStage,
      userText,
      session.answers,
      stageConfig,
      messageId,
      participantPhone,
      participantId,
      thread
    );
    
    return {
      text: llmResponse.text,
      contextUsed: [],
      usageTotalTokens: llmResponse.usageTotalTokens,
    };
  } catch (error) {
    console.warn("🧠 Interview: LLM generation failed, using basic fallback:", error);
    const fallbackResponse = await handleFallbackResponse(
      ctx, 
      stageConfig, 
      messageId, 
      userText, 
      participantPhone, 
      false
    );
    
    return {
      text: fallbackResponse,
    };
  }
}

/**
 * Generate LLM-based interview response using OpenAI
 */
/**
 * Get stage-specific focus areas for enhanced context
 */
function getStageSpecificFocus(stage: InterviewStage): string {
  const focusMap: Record<InterviewStage, string> = {
    intro: "Estabelecer rapport, obter consentimento, explicar metodologia ASA",
    ASA: "Explorar ancestralidade, sabedoria ancestral, impactos sistêmicos, conexões com raízes",
    listas: "Mapear habilidades, conectar competências com identidade ancestral, celebrar conquistas",
    pre_evento: "Preparação mental, expectativas, ansiedades, visualização de sucesso",
    diaD: "Motivação, encorajamento, lembrança das forças identificadas",
    pos_24h: "Reflexão imediata, pontos altos, desafios, sentimentos pós-evento",
    pos_7d: "Processamento de insights, aplicação de aprendizados no cotidiano",
    pos_30d: "Mudanças concretas, influência da metodologia ASA, crescimento contínuo"
  };
  
  return focusMap[stage] || "Continue a conversa de forma natural e empática";
}

/**
 * Format relevant answers based on current stage context
 */
function formatRelevantAnswers(answers: any, currentStage: InterviewStage): string {
  if (!answers || Object.keys(answers).length === 0) {
    return "Nenhuma resposta anterior registrada";
  }

  // Define which previous stages are most relevant for each current stage
  const relevanceMap: Record<InterviewStage, InterviewStage[]> = {
    intro: [],
    ASA: ["intro"],
    listas: ["intro", "ASA"],
    pre_evento: ["ASA", "listas"],
    diaD: ["pre_evento", "listas", "ASA"],
    pos_24h: ["diaD", "pre_evento"],
    pos_7d: ["pos_24h", "diaD", "pre_evento"],
    pos_30d: ["pos_7d", "pos_24h", "listas", "ASA"]
  };

  const relevantStages = relevanceMap[currentStage] || [];
  const relevantAnswers: Record<string, any> = {};

  relevantStages.forEach(stage => {
    if (answers[stage]) {
      relevantAnswers[stage] = answers[stage];
    }
  });

  if (answers[currentStage]) {
    relevantAnswers[currentStage] = answers[currentStage];
  }

  return Object.keys(relevantAnswers).length > 0 
    ? JSON.stringify(relevantAnswers, null, 2)
    : "Nenhum contexto anterior relevante para este estágio";
}

async function generateLLMInterviewResponse(
  ctx: any,
  stage: InterviewStage,
  userText: string,
  answers: any,
  stageConfig: any,
  messageId: string,
  participantPhone: string,
  participantId: string,
  thread: Thread<{ interviewSessionTool: any }> 
): Promise<{ text: string; usageTotalTokens?: number }> {
  try {
    console.log(`🤖 Interview: Processing stage ${stage} for participant ${participantId}`);

    // Build stage-specific system context with enhanced filtering
    const stageContext = [
      `Estágio atual: ${stageConfig.name}`,
      `Descrição: ${stageConfig.description}`,
      `Prompt do estágio: ${stageConfig.prompt || 'Continue a conversa de forma natural.'}`,
      `Foco do estágio: ${getStageSpecificFocus(stage)}`,
      `Contexto relevante: ${formatRelevantAnswers(answers, stage)}`,
    ].join('\n');

    try {
      const result = await thread.generateText(
        { 
          prompt: userText,
          messages: [
            { role: "system", content: stageContext }
          ]
        },
        {
          contextOptions: {
            recentMessages: 20,
            searchOptions: {
              limit: 15,
              textSearch: true,
              vectorSearch: true,
              messageRange: { before: 3, after: 1 },
              vectorScoreThreshold: 0.7
            },
            excludeToolMessages: false,
            searchOtherThreads: true
          },
          storageOptions: {
            saveMessages: "all"
          }
        }
      );

      const aiResponse = result.text?.trim() || "";
      const usage = result.usage as
        | {
            totalTokens?: number;
            promptTokens?: number;
            completionTokens?: number;
          }
        | undefined;
      const totalTokens =
        usage?.totalTokens ??
        (usage
          ? (usage.promptTokens ?? 0) + (usage.completionTokens ?? 0)
          : undefined);

      if (!aiResponse) {
        console.warn("🤖 Interview: AI generated empty response, using fallback");
        const fallbackResponse = stageConfig?.fallbackMessage || "Obrigado por compartilhar. Como posso te ajudar mais?";
        return { text: fallbackResponse };
      }

      console.log(`🤖 Interview: Generated response for stage ${stage}`);
      return {
        text: aiResponse,
        usageTotalTokens: totalTokens,
      };
    } catch (error) {
      console.error("🤖 Interview Agent Error:", error);
      return {
        text: "Desculpe, tive um problema técnico. Pode repetir sua mensagem?",
      };
    }
  } catch (error) {
    console.error("🤖 Interview: Error processing with agent:", error);

    // Log the fallback response
    const fallbackResponse = await handleFallbackResponse(
      ctx, 
      stageConfig, 
      messageId, 
      userText, 
      participantPhone, 
      false
    );

    return { text: fallbackResponse };
  }
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
    // Update the WhatsApp message with interview state data in aiMetadata instead of stateSnapshot
    // The stateSnapshot field is reserved for Twilio webhook processing data
    const message = await ctx.db
      .query("whatsappMessages")
      .withIndex("by_message_id", q => q.eq("messageId", args.messageId))
      .unique();

    if (message) {
      // Store interview state in aiMetadata for debugging and analytics
      const existingAiMetadata = message.aiMetadata;
      await ctx.db.patch(message._id, {
        aiMetadata: {
          model: existingAiMetadata?.model || "interview-system",
          tokens: existingAiMetadata?.tokens || 0,
          processingTimeMs: existingAiMetadata?.processingTimeMs || 0,
          fallbackUsed: existingAiMetadata?.fallbackUsed || false,
          timestamp: Date.now(),
          threadId: existingAiMetadata?.threadId || "interview",
          interviewState: args.stateSnapshot,
        },
      });
    }
    return null;
  },
});

// Queries
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
