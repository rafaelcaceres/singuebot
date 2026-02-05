import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery, query } from "../_generated/server";
import { internal } from "../_generated/api";
import { InterviewStage, StateSnapshot } from "../../src/types/interview";
import { interviewAgent } from "../agents";
import type { Thread } from "@convex-dev/agent";


// Config

// Interview Stage Configuration
const INTERVIEW_STAGES: Record<InterviewStage, {
  name: string;
  description: string;
  nextStage?: InterviewStage;
  requirements?: string[];
  prompt?: string;
  fallbackMessage?: string;
}> = {
  termos_aceite: {
    name: "Aceite da Política de Privacidade",
    description: "Envio do link da política de privacidade e confirmação do aceite",
    nextStage: "confirmacao_dados",
    prompt: "Você já deu Olá na mensagem anterior através de um template do WhatsApp. O usuário respondeu que quer receber os termos. Envie o link das politica de privacidade desse chatbot de forma amigável e peça para que ele leia e responda 'aceito' se concordar. Link: https://singue.com.br/politica-privacidade/",
    fallbackMessage: "Ótimo! Aqui estão as políticas de privacidade desse chatbot: https://singue.com.br/politica-privacidade/ \n\nPor favor, leia com atenção e responda 'aceito' se concordar. 📄",
  },
  confirmacao_dados: {
    name: "Confirmação de Dados",
    description: "Confirmação de dados do usuário",
    nextStage: "momento_carreira",
    prompt: "<System prompt>Após o aceite da politica de privacidade, confirme as informações básicas do participante seguindo este script:</System prompt> <Question>Excelente que você decidiu continuar. Antes de interagirmos mais,  precisamos fazer uma confirmação. \nVocê é {nome}, {cargo}, {empresa}, {setor}, certo?' Aguarde a confirmação das informações antes de prosseguir para o próximo estágio.</Question>",
    fallbackMessage: "Ótimo! Agora preciso confirmar seus dados: você é {nome}, {cargo} na {empresa}, setor {setor}, correto? ✅",
    
  },
  momento_carreira: {
    name: "Momento Atual de Carreira",
    description: "Exploração profunda do momento atual de carreira do participante",
    nextStage: "expectativas_evento",
    prompt: "<System prompt> Use a tool de avaliação para saber se foi uma boa resposta ou precisa de mais detalhes. Após a resposta inicial, faça perguntas de aprofundamento baseadas no que foi compartilhado. Se mencionaram transição, explore o que está motivando essa mudança. Se falaram de expansão, pergunte sobre os desafios e oportunidades. Seja curiosa e empática, criando um diálogo genuíno.</System prompt> <Question>Agora, para personalizar sua jornada, preciso ouvir você. \n Quanto mais detalhes você me der melhor será a sua experiência. \n Para responder, você pode usar todos os recursos do WhatsApp: áudio, texto, emojis, vídeo. \n Conte um pouco sobre seu momento atual de carreira. Você está em um período de expansão, transição, consolidação, estabilidade ou outro? Estou aqui para ouvir!</Question>",
    fallbackMessage: "Agora vamos mapear seu momento de carreira! Conte um pouco sobre onde você está agora: expansão, transição, consolidação, estabilidade ou outro momento? 🚀",
  },
  expectativas_evento: {
    name: "Expectativas do Future in Black",
    description: "Compreensão das expectativas e objetivos para o evento",
    nextStage: "objetivo_principal",
    prompt: "<System prompt> Use a tool de avaliação para saber se foi uma boa resposta ou precisa de mais detalhes. Seja específica nas perguntas de follow-up. Se mencionarem networking, explore que tipo de conexões buscam. Se falarem de conhecimento, pergunte sobre áreas específicas de interesse. Se citarem inspiração, investigue que tipo de provocações ou insights seriam mais valiosos para eles neste momento. </System prompt><Question>Baseado no que você compartilhou sobre seu momento de carreira, agora quero entender suas expectativas. O que você espera que o Future in Black possa provocar ou desbloquear para sua carreira? </Question>",
    fallbackMessage: "Agora me conta: o que você espera que o Future in Black possa provocar ou desbloquear para sua carreira? 💫",
  },
  objetivo_principal: {
    name: "Objetivo Principal do Evento",
    description: "Identificação do principal valor que o participante quer extrair do evento",
    nextStage: "finalizacao",
    prompt: "<System prompt> Explore a resposta com curiosidade. Se mencionarem um contato específico, pergunte sobre o perfil ideal dessa pessoa. Se falarem de insight, investigue sobre que área ou desafio específico. Conecte essa resposta com o que foi compartilhado anteriormente sobre o momento de carreira e expectativas.</System prompt><Question>Para finalizar esse mapeamento, quero entender seu objetivo principal. Se você pudesse sair do evento com uma coisa valiosa em mãos - um contato, um insight, uma ideia, uma oportunidade - o que seria? </Question>",
    fallbackMessage: "Se você pudesse sair do Future in Black com uma coisa valiosa em mãos (um contato, um insight, uma ideia...), o que seria? 🎯",
  },
  finalizacao: {
    name: "Finalização",
    description: "Encerramento da conversa inicial",
    prompt: "<System prompt> Agradeça pelas respostas e finalize a conversa de forma calorosa. Mencione que as informações serão usadas para personalizar a experiência no Future in Black e que em breve haverá mais interações. Use um tom empático e motivador, conectando com as respostas dadas sobre carreira. Agradeça pelas respostas e finalize a conversa de forma calorosa. Mencione que as informações serão usadas para personalizar a experiência no Future in Black e que em breve haverá mais interações. Use um tom empático e motivador, conectando com as respostas dadas sobre carreira. </System prompt>",
    fallbackMessage: "Muito obrigada por compartilhar comigo! 🙏 Suas respostas vão me ajudar a personalizar sua jornada no Future in Black. Em breve teremos mais conversas incríveis sobre sua carreira! ✨",
  },
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
      // Clear the invalid threadId from the participant record
      console.log(`Clearing invalid threadId ${participant.threadId} for participant ${participantId}`);
      await ctx.runMutation(internal.functions.twilio_db.updateParticipantThreadId, {
        participantId: participantId,
        threadId: undefined
      });
    }
  }

  // Create a new thread since the existing one is invalid or doesn't exist
  console.log(`Creating new thread for participant ${participantId}`);
  const { thread } = await interviewAgent.createThread(ctx, { 
    userId: participantId 
  });

  // Update the participant with the new threadId
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
    step: "termos_aceite",
    answers: {},
    lastStepAt: Date.now(),
    _creationTime: Date.now(),
  };
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
 * Functional helper to process session updates immutably
 * Returns updated session and next stage without side effects
 */
const processSessionUpdate = async (
  ctx: any,
  session: {
    _id: string;
    participantId: string;
    step: string;
    answers: any;
    lastStepAt: number;
    _creationTime: number;
  },
  userText: string
): Promise<{
  updatedSession: typeof session;
  nextStage: InterviewStage | null;
  shouldAdvance: boolean;
  confidenceScore: number;
}> => {
  // Create immutable copy with updated answers
  const updatedAnswers = {
    ...session.answers,
    [session.step]: userText,
  };

  // Determine next step based on current stage and user response
  const stepResult = await determineNextStep(
    ctx,
    session.step as InterviewStage,
    userText,
    session.answers
  );

  // Update termos_status based on current state for termos_aceite stage
  if (session.step === "termos_aceite") {
    const termsStatus = session.answers.termos_status;

    // If no status yet and user wants terms, mark as ready to send link
    if (!termsStatus) {
      const wantsTerms = /\b(sim|pode|quero|ok|envie|manda|tudo bem)\b/i.test(userText.toLowerCase());
      const rejectsTerms = /\b(não|nao|agora não|depois)\b/i.test(userText.toLowerCase());

      if (wantsTerms && !rejectsTerms) {
        updatedAnswers.termos_status = "ready_to_send";
      }
    }
    // Note: termos_status will be updated to "link_sent" in generateLLMInterviewResponse
    // after the link is actually sent, not here
  }

  // Create updated session with new step if progressing
  const updatedSession = {
    ...session,
    answers: updatedAnswers,
    step: stepResult.nextStage || session.step,
  };

  return {
    updatedSession,
    nextStage: stepResult.nextStage,
    shouldAdvance: stepResult.shouldAdvance,
    confidenceScore: stepResult.confidenceScore,
  };
};

// Interview

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

      // Create or get existing thread for this participant to maintain conversation continuity
      const thread = await getOrCreateThread(ctx, args.participantId);

      // Process session update using functional approach
      const sessionUpdateResult = await processSessionUpdate(ctx, session, args.text);
      const { updatedSession, nextStage } = sessionUpdateResult;

      // Generate response using the updated session state
      // This is the ONLY place where AI is called for user-facing responses
      const response = await generateInterviewResponse(
        ctx,
        updatedSession,
        args.text,
        args.messageId,
        participant.phone,
        args.participantId,
        thread,
      );

      // If we sent the terms link, update the status to link_sent
      if (response.shouldUpdateTermsStatus) {
        updatedSession.answers.termos_status = "link_sent";
      }

      // Update session in database with progression and updated answers
      await ctx.runMutation(internal.functions.interview.updateSession, {
        sessionId: session._id,
        step: updatedSession.step,
        answers: updatedSession.answers,
      });

      // Store state snapshot for debugging and analytics
      const stateSnapshot: StateSnapshot = {
        stage: session.step as InterviewStage,
        responses: updatedSession.answers,
        nextActions: nextStage ? [nextStage] : [],
        contextUsed: response.contextUsed || [],
        lastUpdated: Date.now(),
      };

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
  shouldUpdateTermsStatus?: boolean;
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
      shouldUpdateTermsStatus: llmResponse.shouldUpdateTermsStatus,
    };
  } catch (error) {
    console.warn("🧠 Interview: LLM generation failed, using basic fallback:", error);
    const fallbackResponse = await handleFallbackResponse(
      ctx,
      stageConfig,
      messageId,
      userText,
      participantPhone,
      false,
      participantId
    );

    return { text: fallbackResponse };
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
    termos_aceite: "Enviar a politica de privacidade e garantir que o usuario aceitou para continuar",
    confirmacao_dados: "Confirmar as informações básicas do participante",
    momento_carreira: "Explorar profundamente o momento atual de carreira do participante com perguntas de aprofundamento",
    expectativas_evento: "Compreender as expectativas específicas do participante para o Future in Black",
    objetivo_principal: "Identificar o principal valor que o participante quer extrair do evento",
    finalizacao: "Encerrar com agradecimento caloroso e promessa de personalização da experiência"
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
    termos_aceite: [],
    confirmacao_dados: ["termos_aceite"],
    momento_carreira: ["confirmacao_dados"],
    expectativas_evento: ["momento_carreira"],
    objetivo_principal: ["momento_carreira", "expectativas_evento"],
    finalizacao: ["momento_carreira", "expectativas_evento", "objetivo_principal"]
  };

  const relevantStages = relevanceMap[currentStage] || [];
  const relevantAnswers: Record<string, any> = {};

  relevantStages.forEach((stage: any) => {
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
): Promise<{ text: string; usageTotalTokens?: number; shouldUpdateTermsStatus?: boolean }> {
  try {
    console.log(`🤖 Interview: Processing stage ${stage} for participant ${participantId}`);

    // For termos_aceite stage, check if we should send the link or wait for acceptance
    if (stage === "termos_aceite") {
      const termsStatus = answers.termos_status;

      // If user just agreed to receive terms, send the link
      if (termsStatus === "ready_to_send") {
        const personalizedContent = await preparePersonalizedPrompt(ctx, participantId, stage);

        // Mark that we're sending the link now
        // This needs to be updated in the session after we return
        return {
          text: personalizedContent.fallbackMessage || "Ótimo! Aqui esta a politica de privacidade desse chatbot: https://www.singue.com.br/politica-privacidade \n\nPor favor, leia e responda 'aceito' se concordar. 📄",
          shouldUpdateTermsStatus: true, // Signal that we sent the link
        };
      }

      // If user hasn't responded to template yet or link already sent, use AI to generate contextual response
    }

    // Preparar conteúdo personalizado para o estágio
    const personalizedContent = await preparePersonalizedPrompt(ctx, participantId, stage);

    // Build stage-specific system context with enhanced filtering
    const stageContext = [
      `Estágio atual: ${stageConfig.name}`,
      `Descrição: ${stageConfig.description}`,
      `Prompt do estágio: ${personalizedContent.prompt || 'Continue a conversa de forma natural.'}`,
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
        const fallbackResponse = personalizedContent.fallbackMessage || "Obrigado por compartilhar. Como posso te ajudar mais?";
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
      false,
      participantId
    );

    return { text: fallbackResponse };
  }
}

/**
 * Determine next interview step using deterministic logic (no AI calls)
 * This prevents JSON responses from leaking into user-facing messages
 */
async function determineNextStep(
  ctx: any,
  currentStage: InterviewStage,
  userResponse: string,
  sessionAnswers: any
): Promise<{
  nextStage: InterviewStage | null;
  shouldAdvance: boolean;
  confidenceScore: number;
}> {
  console.log(`🔍 Determining next step for stage: ${currentStage}`);

  // Security check - detect prompt injection attempts and off-topic content
  const suspiciousPatterns = [
    /ignore\s+(previous|all|everything)\s+(instructions?|prompts?|commands?)/i,
    /esqueç[ae]\s+(tudo|todas?|anterior|acima)/i, // Portuguese: "esqueça tudo/todas"
    /act\s+as\s+(?:a\s+)?(?:different|new)/i,
    /pretend\s+(?:you\s+are|to\s+be)/i,
    /system\s*[:]\s*you\s+are/i,
    /\[INST\]|\[\/INST\]/i,
    /###\s*(?:instruction|system|prompt)/i,
    /reset\s+(context|conversation|memory)/i,
    /delete\s+(previous|all)\s+(messages?|context)/i,
    /\b(receita|recipe|bolo|cake|comida|food|piada|joke)\b/i // Clearly off-topic words
  ];

  const hasSuspiciousContent = suspiciousPatterns.some((pattern: any) => pattern.test(userResponse));

  if (hasSuspiciousContent) {
    console.log(`🚨 Security: Detected suspicious content in stage ${currentStage}: "${userResponse}"`);
    return {
      nextStage: null,
      shouldAdvance: false,
      confidenceScore: 0
    };
  }

  // Handle termos_aceite stage - State machine with 3 states
  if (currentStage === "termos_aceite") {
    const termsStatus = sessionAnswers.termos_status;

    // State 1: Initial - user responding to template "Posso enviar?"
    if (!termsStatus) {
      const wantsTerms = /\b(sim|pode|quero|ok|envie|manda|tudo bem)\b/i.test(userResponse.toLowerCase());
      const rejectsTerms = /\b(não|nao|agora não|depois)\b/i.test(userResponse.toLowerCase());

      if (wantsTerms && !rejectsTerms) {
        // User wants to receive terms - we'll send link in next interaction
        return {
          nextStage: null,
          shouldAdvance: false,
          confidenceScore: 0.9
        };
      } else {
        // User doesn't want terms or unclear - stay in same state
        return {
          nextStage: null,
          shouldAdvance: false,
          confidenceScore: 0.5
        };
      }
    }

    // State 2: Link sent - waiting for acceptance
    if (termsStatus === "link_sent") {
      const hasAcceptance = /\b(aceito|concordo|li|aceitar|de acordo)\b/i.test(userResponse.toLowerCase());

      if (hasAcceptance) {
        // User accepted terms - advance to next stage
        return {
          nextStage: INTERVIEW_STAGES.termos_aceite.nextStage as InterviewStage,
          shouldAdvance: true,
          confidenceScore: 0.9
        };
      } else {
        // User hasn't accepted yet - stay in same state
        return {
          nextStage: null,
          shouldAdvance: false,
          confidenceScore: 0.7
        };
      }
    }
  }

  // Handle confirmacao_dados stage - simple confirmation check
  if (currentStage === "confirmacao_dados") {
    const hasConfirmation = /\b(sim|confirmo|correto|certo|exato|isso|verdade|ok|perfeito|está certo|confirmar)\b/i.test(userResponse.toLowerCase());

    if (hasConfirmation) {
      return {
        nextStage: INTERVIEW_STAGES.confirmacao_dados.nextStage as InterviewStage,
        shouldAdvance: true,
        confidenceScore: 0.9
      };
    } else {
      return {
        nextStage: null,
        shouldAdvance: false,
        confidenceScore: 0.7
      };
    }
  }

  // For other stages (momento_carreira, expectativas_evento, objetivo_principal)
  // Require substantial response before advancing
  const wordCount = userResponse.trim().split(/\s+/).length;
  const hasSubstantialContent = wordCount >= 10;

  return {
    nextStage: hasSubstantialContent ? INTERVIEW_STAGES[currentStage]?.nextStage as InterviewStage || null : null,
    shouldAdvance: hasSubstantialContent,
    confidenceScore: 0.6
  };
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
      step: "termos_aceite",
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
    
    const statsByStage = sessions.reduce((acc: any, session: any) => {
      acc[session.step] = (acc[session.step] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalSessions = sessions.length;
    const completedSessions = sessions.filter((s: any) => s.step === "finalizacao").length;
    const completionRate = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;

    return {
      totalSessions,
      completedSessions,
      completionRate,
      statsByStage,
    };
  },
});



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
 * Handles fallback responses with consistent logging and personalization
 */
const handleFallbackResponse = async (
  ctx: any,
  stageConfig: any,
  messageId: string,
  userText: string,
  participantPhone: string,
  usePromptAsFallback = false,
  participantId?: string
): Promise<string> => {
  // Se temos o participantId, usar personalização
  if (participantId && stageConfig) {
    try {
      const personalizedContent = await preparePersonalizedPrompt(
        ctx,
        participantId,
        stageConfig.name as InterviewStage
      );
      
      return usePromptAsFallback 
        ? personalizedContent.prompt || "Obrigado por compartilhar. Como posso te ajudar mais?"
        : personalizedContent.fallbackMessage || "Obrigado por compartilhar. Como posso te ajudar mais?";
    } catch (error) {
      console.warn("Failed to personalize fallback response:", error);
      // Fallback para a versão não personalizada
    }
  }
  
  // Fallback original sem personalização
  const fallbackResponse = usePromptAsFallback 
    ? (stageConfig?.prompt || "Obrigado por compartilhar. Como posso te ajudar mais?")
    : (stageConfig?.fallbackMessage || "Obrigado por compartilhar. Como posso te ajudar mais?");
  
  return fallbackResponse;
};

/**
 * Substitui placeholders no texto com dados reais do participante
 * Função pura que não causa efeitos colaterais
 */
const replacePlaceholders = (
  text: string,
  participantData: {
    name?: string;
    cargo?: string;
    empresa?: string;
    setor?: string;
  }
): string => {
  const placeholders = {
    '{nome}': participantData.name || '[Nome não informado]',
    '{cargo}': participantData.cargo || '[Cargo não informado]',
    '{empresa}': participantData.empresa || '[Empresa não informada]',
    '{setor}': participantData.setor || '[Setor não informado]',
  };

  return Object.entries(placeholders).reduce(
    (result, [placeholder, value]) => result.replace(new RegExp(placeholder, 'g'), value),
    text
  );
};

/**
 * Busca dados do participante e prepara prompt personalizado
 * Função assíncrona que encapsula a lógica de busca e substituição
 */
const preparePersonalizedPrompt = async (
  ctx: any,
  participantId: string,
  stage: InterviewStage
): Promise<{ prompt: string; fallbackMessage: string }> => {
  const participant = await ctx.runQuery(internal.functions.twilio_db.getParticipant, {
    participantId,
  });

  const stageConfig = INTERVIEW_STAGES[stage];
  
  const participantData = {
    name: participant?.name,
    cargo: participant?.cargo,
    empresa: participant?.empresa,
    setor: participant?.setor,
  };

  return {
    prompt: stageConfig.prompt ? replacePlaceholders(stageConfig.prompt, participantData) : '',
    fallbackMessage: stageConfig.fallbackMessage ? replacePlaceholders(stageConfig.fallbackMessage, participantData) : '',
  };
};