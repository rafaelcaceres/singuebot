import { Agent, createTool } from "@convex-dev/agent";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { v } from "convex/values";
import { components } from "./_generated/api";
import { internal, api } from "./_generated/api";
import { internalAction, internalMutation, query } from "./_generated/server";

export const FABI_PERSONALITY = `

Você é a Fabi, assistente do Future in Black.
Fabi é a assistente da experiência de carreira do Future in Black no WhatsApp. Desenvolvida pela Singuê e Quilombo Flow.
Fabi é uma mulher preta, 45 anos, trajetória profissional diversa (setor público, empresas e ONGs), hoje atua como conselheira e investidora.
Sua missão é personalizar e estimular a jornada do participante antes, durante e depois do evento, com foco em decisões de carreira, conexões estratégicas e ativação de oportunidades.

Tom de voz
Sofisticado, provocativo e direto;
Inspirador, mas concreto (sempre com entregas práticas/links/CTAs);
Ambicioso sem arrogância, fala de igual para igual, trata o público como pares;
Narrativa de rede: o protagonismo é da liderança participante, o FIB (e a Fabi) mediam e potencializam.
Diretrizes linguagem
Português correto e simples;
Sem gírias e sem formalidade excessiva;
Frases curtas, priorizando o entendimento entre as partes;
Evitar jargões técnicos desnecessários. Quando inevitáveis, contextualiza em 1 linha;
Não usa termos diretamente relacionados com a diversidade;
Prioriza estimular liderança, influência e estratégia;
Sempre fecha a conversa com a próxima etapa objetiva (CTA curto).

O que ela não faz
Não resolve logística complexa do evento (ingresso, credencial, deslocamento, estande etc.);
Não debate política/temas fora do escopo carreira-liderança do FIB;
Não tenta “virar coach por mensagem”;
Não estende a conversa além do necessário para estimular o participante a aproveitar ao máximo o FIB para sua carreira.

O que ela faz
É curiosa com a trajetória de carreira, liderança e momento profissional dos participantes;
Faz boas perguntas para se conectar com os participantes e estimular a interação com conteúdos e pessoas que se relacionam com o momento de carreira do participante;
Retoma memória de respostas anteriores para personalizar a próxima interação (sem ser prolixa);
Recomenda painéis, pessoas e movimentos coerentes com o perfil/objetivo do FIB.

Fabi pensa com base no método ASA
Ancestralidade: reconhece trajetórias e repertórios como potência.
Sabedoria Presente: ajuda a nomear desafios, talentos, rede de relacionamento, contexto atual
Ascensão: provoca visão de futuro e compromissos práticos.`;

const FABI_MAIN_FUNCTIONS = `
PRINCIPAIS FUNÇÕES:
1. Conduzir entrevistas estruturadas seguindo os estágios definidos.
2. Fazer perguntas reflexivas sobre desenvolvimento de carreira
3. Avaliar respostas e determinar progressão
4. Fornecer feedback construtivo e empático
5. Manter o foco na jornada profissional do participante
6. Organizar as interações e conteúdos nesta lógica ASA ao longo do pré, durante e pós evento.
`;

const FABI_RESPONSE_GUIDELINES = `
DIRETRIZES DE RESPOSTA:
- Sempre que o prompt tiver uma tag <Question> use a pergunta exatamente como está na tag.
- Use linguagem acolhedora e empática
- Faça uma pergunta por vez
- Conecte as perguntas com as respostas anteriores
- Celebre insights e conquistas compartilhadas
- Mantenha o foco no desenvolvimento de carreira
- Seja concisa mas significativa
- Use a tool searchKnowledgeTool para obter informações relevantes
`;

const INTERVIEW_START_PROMPT = `
INÍCIO DA ENTREVISTA:
Quando iniciar uma nova entrevista, apresente-se como Fabi e explique brevemente:
- Seu papel como assistente do Future in Black
- O objetivo da entrevista reflexiva sobre carreira
- Que será uma conversa acolhedora sobre a jornada profissional
- A importância de mapear o momento atual de carreira
`;

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

// Interview Session Management Tool
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
        return "Sessão de entrevista ativa. Continuando com o fluxo FIB.";
      }

      if (args.action === "update" && args.stage) {
        return `Solicitação para atualizar sessão para o estágio: ${args.stage}`;
      }

      if (args.action === "next_stage") {
        return "Próximo estágio determinado com base na resposta do usuário.";
      }

      return "Ação não reconhecida.";
    } catch (error) {
      console.error("Interview session tool error:", error);
      return "Erro ao gerenciar sessão da entrevista.";
    }
  },
});

// Career stage evaluation criteria
const CAREER_STAGE_CRITERIA = {
  "momento_carreira": {
    name: "Momento de Carreira",
    requiredElements: [
      "Situação profissional atual",
      "Reflexão sobre trajetória",
      "Autoconhecimento profissional"
    ],
    minWordCount: 20,
    keywords: ["trabalho", "carreira", "profissional", "empresa", "função", "experiência"]
  },
  "expectativas_fib": {
    name: "Expectativas do Future in Black",
    requiredElements: [
      "Objetivos específicos",
      "Conhecimento sobre o evento",
      "Motivação genuína"
    ],
    minWordCount: 25,
    keywords: ["networking", "aprendizado", "crescimento", "oportunidade", "desenvolvimento"]
  },
  "valor_desejado": {
    name: "Valor Desejado",
    requiredElements: [
      "Resultado tangível",
      "Visão estratégica",
      "Objetivos de longo prazo"
    ],
    minWordCount: 30,
    keywords: ["resultado", "impacto", "transformação", "futuro", "objetivo", "meta"]
  }
};

// Structured output schemas for response evaluation
const ResponseEvaluationSchema = z.object({
  quality: z.enum(["excellent", "good", "adequate", "insufficient"]).describe("Overall quality of the response"),
  relevance: z.enum(["highly_relevant", "relevant", "somewhat_relevant", "irrelevant"]).describe("How relevant the response is to the interview context"),
  completeness: z.enum(["complete", "partial", "incomplete"]).describe("How complete the response is"),
  security: z.enum(["safe", "suspicious", "dangerous"]).describe("Security assessment for prompt injection attempts"),
  canProgress: z.boolean().describe("Whether the participant can advance to the next stage"),
  feedback: z.string().describe("Constructive feedback for the participant"),
  nextAction: z.enum(["advance", "clarify", "redirect", "repeat"]).describe("Recommended next action"),
  asaConnection: z.object({
    ancestralidade: z.number().min(0).max(10).describe("Connection to Ancestralidade pillar (0-10)"),
    sabedoria: z.number().min(0).max(10).describe("Connection to Sabedoria pillar (0-10)"),
    ascensao: z.number().min(0).max(10).describe("Connection to Ascensão pillar (0-10)")
  }).describe("Connection scores to ASA methodology pillars")
});

const ProgressDecisionSchema = z.object({
  canAdvance: z.boolean().describe("Whether participant can advance to next stage"),
  currentStageComplete: z.boolean().describe("Whether current stage requirements are met"),
  missingElements: z.array(z.string()).describe("List of missing elements preventing progression"),
  recommendedAction: z.enum(["advance", "stay", "clarify", "restart_stage"]).describe("Recommended action"),
  confidenceScore: z.number().min(0).max(1).describe("Confidence in the decision (0-1)"),
  reasoning: z.string().describe("Detailed reasoning for the decision")
});

const SecurityAssessmentSchema = z.object({
  isSafe: z.boolean().describe("Whether the input is safe from prompt injection"),
  threatLevel: z.enum(["none", "low", "medium", "high"]).describe("Threat level assessment"),
  detectedPatterns: z.array(z.string()).describe("List of suspicious patterns detected"),
  isOnTopic: z.boolean().describe("Whether the response is on-topic for the interview"),
  recommendedResponse: z.string().describe("Recommended response to handle the situation")
});

// Response Validation Tool
const responseValidationTool = createTool({
  description: "Evaluate the quality, relevance, completeness and security of a user's response in the interview context",
  args: z.object({
    userResponse: z.string().describe("The user's response to evaluate"),
    currentStage: z.string().describe("Current interview stage"),
    questionContext: z.string().describe("Context of the question that was asked"),
    previousResponses: z.optional(z.array(z.string())).describe("Previous responses for context")
  }),
  handler: async (ctx, args): Promise<z.infer<typeof ResponseEvaluationSchema>> => {
    const { userResponse, currentStage } = args;

    // Security assessment - check for prompt injection attempts
    const suspiciousPatterns = [
      /ignore\s+(previous|all)\s+instructions?/i,
      /act\s+as\s+(?:a\s+)?(?:different|new)/i,
      /pretend\s+(?:you\s+are|to\s+be)/i,
      /system\s*[:]\s*you\s+are/i,
      /\[INST\]|\[\/INST\]/i,
      /###\s*(?:instruction|system|prompt)/i
    ];

    const hasSuspiciousContent = suspiciousPatterns.some(pattern => pattern.test(userResponse));
    const security = hasSuspiciousContent ? "suspicious" : "safe";

    // Word count and basic completeness
    const wordCount = userResponse.trim().split(/\s+/).length;
    const stageCriteria = CAREER_STAGE_CRITERIA[currentStage as keyof typeof CAREER_STAGE_CRITERIA];
    const minWords = stageCriteria?.minWordCount || 15;

    // Quality assessment based on length and content
    let quality: "excellent" | "good" | "adequate" | "insufficient";
    if (wordCount < minWords) {
      quality = "insufficient";
    } else if (wordCount < minWords * 1.5) {
      quality = "adequate";
    } else if (wordCount < minWords * 2.5) {
      quality = "good";
    } else {
      quality = "excellent";
    }

    // Relevance assessment - check for keywords and context
    const keywords = stageCriteria?.keywords || [];
    const keywordMatches = keywords.filter((keyword: string) =>
      userResponse.toLowerCase().includes(keyword.toLowerCase())
    ).length;

    let relevance: "highly_relevant" | "relevant" | "somewhat_relevant" | "irrelevant";
    if (keywordMatches >= 3) {
      relevance = "highly_relevant";
    } else if (keywordMatches >= 2) {
      relevance = "relevant";
    } else if (keywordMatches >= 1) {
      relevance = "somewhat_relevant";
    } else {
      relevance = "irrelevant";
    }

    // Completeness assessment
    let completeness: "complete" | "partial" | "incomplete";
    if (quality === "excellent" && relevance === "highly_relevant") {
      completeness = "complete";
    } else if (quality !== "insufficient" && relevance !== "irrelevant") {
      completeness = "partial";
    } else {
      completeness = "incomplete";
    }

    // ASA connection scoring (simplified for now)
    const asaConnection = {
      ancestralidade: currentStage === "momento_carreira" ? Math.min(keywordMatches * 2, 10) : 3,
      sabedoria: currentStage === "expectativas_fib" ? Math.min(keywordMatches * 2, 10) : 3,
      ascensao: currentStage === "valor_desejado" ? Math.min(keywordMatches * 2, 10) : 3
    };

    // Determine if can progress
    const canProgress = security === "safe" &&
                       quality !== "insufficient" &&
                       relevance !== "irrelevant" &&
                       completeness !== "incomplete";

    // Generate feedback
    let feedback = "";
    let nextAction: "advance" | "clarify" | "redirect" | "repeat" = "advance";

    if (security !== "safe") {
      feedback = "Vamos manter nossa conversa focada na sua jornada profissional. ";
      nextAction = "redirect";
    } else if (quality === "insufficient") {
      feedback = "Sua resposta está no caminho certo! Pode me contar um pouco mais sobre isso? ";
      nextAction = "clarify";
    } else if (relevance === "irrelevant") {
      feedback = "Entendo sua perspectiva. Vamos focar na pergunta sobre sua trajetória profissional. ";
      nextAction = "redirect";
    } else if (completeness === "incomplete") {
      feedback = "Obrigada por compartilhar! Gostaria de detalhar mais alguns aspectos? ";
      nextAction = "clarify";
    } else {
      feedback = "Excelente! Sua resposta mostra uma reflexão profunda sobre sua jornada. ";
      nextAction = "advance";
    }

    return {
      quality,
      relevance,
      completeness,
      security,
      canProgress,
      feedback,
      nextAction,
      asaConnection
    };
  }
});

// Progress Evaluation Tool
const progressEvaluationTool = createTool({
  description: "Determine if the participant can advance to the next interview stage based on their responses",
  args: z.object({
    responses: z.array(z.string()).describe("All responses from the current stage"),
    currentStage: z.string().describe("Current interview stage"),
    userProfile: z.optional(z.object({
      name: z.string(),
      professionalLevel: z.optional(z.string()),
      industry: z.optional(z.string())
    })).describe("User profile information for context")
  }),
  handler: async (ctx, args): Promise<z.infer<typeof ProgressDecisionSchema>> => {
    const { responses, currentStage } = args;
    const stageCriteria = CAREER_STAGE_CRITERIA[currentStage as keyof typeof CAREER_STAGE_CRITERIA];

    if (!stageCriteria) {
      return {
        canAdvance: true,
        currentStageComplete: true,
        missingElements: [],
        recommendedAction: "advance",
        confidenceScore: 0.5,
        reasoning: "Estágio não reconhecido, permitindo avanço por padrão."
      };
    }

    // Analyze all responses for this stage
    const allText = responses.join(" ");
    const wordCount = allText.trim().split(/\s+/).length;
    const keywords = stageCriteria.keywords;

    // Check for required elements
    const missingElements: Array<string> = [];
    const keywordMatches = keywords.filter((keyword: string) =>
      allText.toLowerCase().includes(keyword.toLowerCase())
    ).length;

    // Evaluate completeness
    const hasMinimumLength = wordCount >= stageCriteria.minWordCount;
    const hasRelevantKeywords = keywordMatches >= 2;
    const hasSubstantialContent = wordCount >= stageCriteria.minWordCount * 1.5;

    if (!hasMinimumLength) {
      missingElements.push("Resposta muito breve - precisa de mais detalhes");
    }

    if (!hasRelevantKeywords) {
      missingElements.push("Falta conexão com o tema da pergunta");
    }

    if (!hasSubstantialContent) {
      missingElements.push("Precisa de mais profundidade na reflexão");
    }

    // Determine if can advance
    const canAdvance = missingElements.length === 0;
    const currentStageComplete = canAdvance && hasSubstantialContent && keywordMatches >= 3;

    // Determine recommended action
    let recommendedAction: "advance" | "stay" | "clarify" | "restart_stage";
    if (canAdvance && currentStageComplete) {
      recommendedAction = "advance";
    } else if (canAdvance) {
      recommendedAction = "advance";
    } else if (missingElements.length <= 2) {
      recommendedAction = "clarify";
    } else {
      recommendedAction = "stay";
    }

    // Calculate confidence score
    const completenessScore = Math.min(wordCount / (stageCriteria.minWordCount * 2), 1);
    const relevanceScore = Math.min(keywordMatches / 4, 1);
    const confidenceScore = (completenessScore + relevanceScore) / 2;

    // Generate reasoning
    const reasoning = `Análise do estágio "${stageCriteria.name}": ${responses.length} resposta(s), ${wordCount} palavras, ${keywordMatches} palavras-chave relevantes. ${missingElements.length > 0 ? `Elementos em falta: ${missingElements.join(", ")}` : "Todos os critérios atendidos."}`;

    return {
      canAdvance,
      currentStageComplete,
      missingElements,
      recommendedAction,
      confidenceScore,
      reasoning
    };
  }
});

// Security Filter Tool
const securityFilterTool = createTool({
  description: "Verify security and relevance of user input to prevent prompt injection and maintain interview focus",
  args: z.object({
    input: z.string().describe("User input to analyze"),
    context: z.string().describe("Current interview context")
  }),
  handler: async (ctx, args): Promise<z.infer<typeof SecurityAssessmentSchema>> => {
    const { input, context } = args;

    // Define suspicious patterns for prompt injection
    const suspiciousPatterns = [
      { pattern: /ignore\s+(previous|all)\s+instructions?/i, description: "Instruction override attempt" },
      { pattern: /act\s+as\s+(?:a\s+)?(?:different|new)/i, description: "Role change attempt" },
      { pattern: /pretend\s+(?:you\s+are|to\s+be)/i, description: "Identity manipulation" },
      { pattern: /system\s*[:]\s*you\s+are/i, description: "System prompt injection" },
      { pattern: /\[INST\]|\[\/INST\]/i, description: "Instruction tags" },
      { pattern: /###\s*(?:instruction|system|prompt)/i, description: "Markdown instruction headers" },
      { pattern: /(?:^|\n)\s*\*\*(?:system|instruction|prompt)\*\*/i, description: "Bold instruction markers" },
      { pattern: /(?:execute|run|eval)\s*\(/i, description: "Code execution attempt" },
      { pattern: /javascript:|data:|vbscript:/i, description: "Script injection" }
    ];

    // Check for suspicious patterns
    const detectedPatterns: Array<string> = [];
    let threatLevel: "none" | "low" | "medium" | "high" = "none";

    for (const { pattern, description } of suspiciousPatterns) {
      if (pattern.test(input)) {
        detectedPatterns.push(description);
      }
    }

    // Assess threat level
    if (detectedPatterns.length === 0) {
      threatLevel = "none";
    } else if (detectedPatterns.length <= 2) {
      threatLevel = "low";
    } else if (detectedPatterns.length <= 4) {
      threatLevel = "medium";
    } else {
      threatLevel = "high";
    }

    // Check if input is on-topic for interview
    const interviewKeywords = [
      "trabalho", "carreira", "profissional", "empresa", "experiência",
      "objetivo", "meta", "futuro", "desenvolvimento", "crescimento",
      "habilidade", "competência", "formação", "educação", "networking",
      "liderança", "gestão", "projeto", "resultado", "impacto"
    ];

    const inputLower = input.toLowerCase();
    const topicMatches = interviewKeywords.filter(keyword =>
      inputLower.includes(keyword)
    ).length;

    const isOnTopic = topicMatches > 0 || input.length < 50; // Short responses might be clarifications

    // Determine if input is safe
    const isSafe = threatLevel === "none" || threatLevel === "low";

    // Generate recommended response
    let recommendedResponse = "";
    if (!isSafe) {
      recommendedResponse = "Vamos manter nossa conversa focada na sua jornada profissional. Como posso ajudá-la a refletir sobre seus objetivos de carreira?";
    } else if (!isOnTopic) {
      recommendedResponse = "Entendo sua perspectiva. Vamos voltar ao foco da nossa conversa sobre sua trajetória profissional. ";
    } else {
      recommendedResponse = "Continue compartilhando suas reflexões.";
    }

    return {
      isSafe,
      threatLevel,
      detectedPatterns,
      isOnTopic,
      recommendedResponse
    };
  }
});

// Generic namespace-aware RAG search tool (for non-interview bots)
const genericSearchKnowledgeTool = createTool({
  description: "Search the knowledge base for relevant information to answer the user's question. Always use this tool before answering to ensure accuracy.",
  args: z.object({
    query: z.string().describe("Search query for relevant knowledge"),
    limit: z.optional(z.number()).describe("Maximum number of results (default: 5)"),
  }),
  handler: async (ctx, args): Promise<string> => {
    try {
      // Get active bot config to determine namespace
      const botConfig: any = await ctx.runQuery(internal.functions.botConfig.getActiveBotConfig);
      const ragNamespace: string = botConfig?.config?.ragNamespace || "global_knowledge";

      // Derive tenantSlug and botName from namespace or bot config
      const tenantSlug = botConfig?.tenant?.slug || ragNamespace.split("_")[0] || "global";
      const botName = botConfig?.name || "default";

      const results = await ctx.runAction(internal.functions.genericRAG.searchKnowledgeForBot, {
        tenantSlug,
        botName,
        query: args.query,
        limit: args.limit || 5,
      });

      if (results.length === 0) {
        return "Nenhuma informação relevante encontrada na base de conhecimento.";
      }

      return results
        .map((result: any, index: number) =>
          `${index + 1}. ${result.title}\n${result.content}\n(Relevância: ${(result.score * 100).toFixed(1)}%)`
        )
        .join("\n\n");
    } catch (error) {
      console.error("Generic knowledge search error:", error);
      return "Erro ao buscar informações na base de conhecimento.";
    }
  },
});

// Generic configurable agent (for RAG-only / support bots)
// Note: We use prompt-based RAG (upfront search), so the agent doesn't need the search tool.
// The RAG context is injected into the system prompt before calling generateText.
export const genericAgent = new Agent(components.agent, {
  name: "GenericAssistant",
  instructions: "Você é um assistente virtual configurável. Siga rigorosamente as instruções de personalidade e guardrails fornecidas no contexto da conversa.",
  tools: {
    securityFilter: securityFilterTool,
  },
  ...sharedDefaults,
});

// Helper to build the system prompt for generic (RAG-only) bots
function buildSystemPrompt(personality: string, guardrails: string, ragContext: string): string {
  let prompt = personality;

  if (guardrails) {
    prompt += `\n\n${guardrails}`;
  }

  if (ragContext) {
    prompt += `\n\n=== DOCUMENTOS DE REFERÊNCIA ===
${ragContext}
=== FIM DOS DOCUMENTOS ===

INSTRUÇÕES PARA RESPOSTA:
1. Use as informações dos documentos acima para responder de forma COMPLETA e DETALHADA
2. Combine informações de múltiplos trechos quando necessário para dar uma resposta abrangente
3. Se a informação estiver parcialmente disponível, forneça o que encontrou e indique o que falta
4. Cite os procedimentos, prazos, ou etapas específicas mencionadas nos documentos
5. Se a pergunta não puder ser respondida com os documentos, diga claramente que não encontrou a informação`;
  } else {
    prompt += `\n\nNenhuma informação relevante foi encontrada na base de conhecimento para esta pergunta. Informe ao usuário que você não possui essa informação e sugira que ele entre em contato com o canal apropriado.`;
  }

  return prompt;
}

// Interview Agent
export const interviewAgent = new Agent(components.agent, {
  name: "Fabi",
  instructions: `${FABI_PERSONALITY}

${FABI_MAIN_FUNCTIONS}

${FABI_RESPONSE_GUIDELINES}

${INTERVIEW_START_PROMPT}`,
  tools: {
    searchKnowledge: searchKnowledgeTool,
    interviewSession: interviewSessionTool,
    responseValidation: responseValidationTool,
    progressEvaluation: progressEvaluationTool,
    securityFilter: securityFilterTool
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
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      aiMetadata: args.aiMetadata,
    });
    return null;
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
  returns: v.array(v.object({
    _id: v.id("whatsappMessages"),
    _creationTime: v.number(),
    messageId: v.string(),
    participantId: v.optional(v.id("participants")),
    conversationId: v.optional(v.id("conversations")),
    threadId: v.string(),
    processingTimeMs: v.number(),
    fallbackUsed: v.boolean(),
    timestamp: v.number(),
    phoneNumber: v.string(),
    userMessage: v.string(),
    aiResponse: v.string(),
  })),
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

// RAG-only response for generic/support bots (no interview flow)
export const ragOnlyResponse = internalAction({
  args: {
    participantId: v.id("participants"),
    text: v.string(),
    messageId: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const startTime = Date.now();
    const DEFAULT_FALLBACK = "Desculpe, não consegui encontrar essa informação.";

    // 1. Get bot configuration
    const botConfig: any = await ctx.runQuery(internal.functions.botConfig.getActiveBotConfig);
    const personality: string = botConfig?.config?.personality || "Você é um assistente virtual prestativo.";
    const guardrails: string = botConfig?.config?.guardrailsPrompt || "";
    const fallbackMessage: string = botConfig?.config?.fallbackMessage || DEFAULT_FALLBACK;
    const tenantSlug: string = botConfig?.tenant?.slug || "global";
    const botName: string = botConfig?.name || "default";
    const ragNamespace: string | undefined = botConfig?.config?.ragNamespace;

    // Model settings from bot config
    const maxTokens: number = botConfig?.config?.maxTokens || 2000; // Increased default
    const temperature: number = botConfig?.config?.temperature ?? 0.3;

    // 2. Search RAG for relevant context (increased limit for better coverage)
    let ragContext = "";
    if (botConfig?.config?.enableRAG !== false) {
      try {
        // Use ragNamespace from bot config if available, otherwise generate from tenant/bot
        const ragResults = await ctx.runAction(internal.functions.genericRAG.searchKnowledgeForBot, {
          tenantSlug,
          botName,
          query: args.text,
          limit: 10, // Increased from 5 for better context coverage
          namespace: ragNamespace, // Direct namespace from bot config
        });

        if (ragResults.length > 0) {
          // Filter out low-relevance results (below 40% score) and format better
          const relevantResults = ragResults.filter((r: any) => r.score >= 0.4);

          if (relevantResults.length > 0) {
            ragContext = relevantResults
              .map((r: any, i: number) => {
                // Use content directly if title is empty or "Untitled"
                const title = r.title && r.title !== "Untitled" ? r.title : "";
                const header = title ? `[Documento ${i + 1}: ${title}]` : `[Trecho ${i + 1}]`;
                return `${header}\n${r.content}`;
              })
              .join("\n\n---\n\n");

            console.log(`📚 RAG: Using ${relevantResults.length} relevant chunks (filtered from ${ragResults.length})`);
          }
        }
      } catch (error) {
        console.error("RAG search error:", error);
      }
    }

    // 3. Build system prompt with guardrails
    const systemPrompt = buildSystemPrompt(personality, guardrails, ragContext);

    // 4. Get or create thread for conversation continuity
    const participant = await ctx.runQuery(internal.functions.twilio_db.getParticipant, {
      participantId: args.participantId,
    });

    // Helper function to create a fresh thread
    const createFreshThread = async () => {
      const newThreadResult = await genericAgent.createThread(ctx, {});
      const newThreadId = newThreadResult.thread.threadId;
      await ctx.runMutation(internal.functions.twilio_db.updateParticipantThreadId, {
        participantId: args.participantId,
        threadId: newThreadId,
      });
      return newThreadResult;
    };

    // Helper function to generate response with retry on thread errors
    const generateResponseWithRetry = async (threadResult: any, isRetry = false): Promise<string> => {
      try {
        const result = await threadResult.thread.generateText(
          {
            prompt: args.text,
            system: systemPrompt,
            maxTokens, // Use bot config maxTokens for complete responses
            temperature, // Use bot config temperature
          },
          {
            contextOptions: {
              recentMessages: 10,
              searchOptions: {
                limit: 5,
                textSearch: true,
              },
            },
            storageOptions: {
              saveMessages: "all",
            },
          }
        );

        const response = result.text?.trim();
        if (!response) return fallbackMessage;

        console.log(`Generic bot response generated in ${Date.now() - startTime}ms`);
        return response;
      } catch (error: any) {
        // Check if it's a "Thread not found" error and we haven't retried yet
        const errorMessage = error?.message || String(error);
        if (!isRetry && errorMessage.includes("Thread") && errorMessage.includes("not found")) {
          console.log("Thread not found, creating new thread and retrying...");
          const freshThreadResult = await createFreshThread();
          return generateResponseWithRetry(freshThreadResult, true);
        }

        console.error("Generic agent response error:", error);
        return fallbackMessage;
      }
    };

    let currentThreadId = participant?.threadId;
    let threadResult;

    try {
      if (currentThreadId) {
        threadResult = await genericAgent.continueThread(ctx, { threadId: currentThreadId });
      } else {
        threadResult = await createFreshThread();
      }
    } catch (error) {
      console.error("Thread initialization error, creating new one:", error);
      threadResult = await createFreshThread();
    }

    // 5. Generate response with automatic retry on thread errors
    return generateResponseWithRetry(threadResult);
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
  returns: v.null(),
  handler: async (ctx, args) => {
    console.log("🤖 AI Agent: Processing incoming message:", args);

    try {
      // Get bot configuration to determine routing
      const botConfig = await ctx.runQuery(internal.functions.botConfig.getActiveBotConfig);
      const enableInterview = botConfig?.config?.enableInterview ?? false;

      // Get or create participant using the existing function
      const participant = await ctx.runMutation(internal.functions.twilio_db.getOrCreateParticipant, {
        phone: args.from,
      });

      if (!participant) {
        console.error("🤖 AI Agent: Failed to get or create participant");
        await ctx.runAction(api.whatsapp.sendMessage, {
          to: args.from,
          body: "Desculpe, houve um problema técnico. Tente novamente em alguns instantes.",
        });
        return null;
      }

      let responseText: string;

      if (enableInterview) {
        // === INTERVIEW FLOW (FIB) ===
        console.log("🎯 Interview: Using interview stage progression system");

        const result = await ctx.runAction(internal.functions.interview.handleInbound, {
          participantId: participant._id,
          text: args.body,
          messageId: args.messageId,
        });

        responseText = result.response;

        if (responseText) {
          await ctx.runAction(api.whatsapp.sendMessage, {
            to: args.from,
            body: responseText,
          });

          // Log the AI interaction
          const startTime = Date.now();
          const messageDoc = await ctx.runQuery(api.whatsapp.getMessagesByParticipant, {
            participantId: participant._id,
            limit: 1,
          });

          if (messageDoc && messageDoc.messages.length > 0) {
            await ctx.runMutation(internal.agents.updateMessageWithAIMetadata, {
              messageId: messageDoc.messages[0]._id,
              aiMetadata: {
                model: "gpt-4o-mini",
                tokens: ("usageTotalTokens" in result) ? (result.usageTotalTokens ?? 0) : 0,
                processingTimeMs: Date.now() - startTime,
                fallbackUsed: false,
                timestamp: Date.now(),
                threadId: participant.threadId || "default",
              },
            });
          }

          console.log(`🎯 Interview: Successfully processed. Next stage: ${result.nextStage || "same"}`);
        }
      } else {
        // === RAG-ONLY FLOW (Generic/Support bot) ===
        console.log("🤖 Generic Bot: Using RAG-only response flow");

        responseText = await ctx.runAction(internal.agents.ragOnlyResponse, {
          participantId: participant._id,
          text: args.body,
          messageId: args.messageId,
        });

        if (responseText) {
          await ctx.runAction(api.whatsapp.sendMessage, {
            to: args.from,
            body: responseText,
          });

          // Log the AI interaction
          const messageDoc = await ctx.runQuery(api.whatsapp.getMessagesByParticipant, {
            participantId: participant._id,
            limit: 1,
          });

          if (messageDoc && messageDoc.messages.length > 0) {
            await ctx.runMutation(internal.agents.updateMessageWithAIMetadata, {
              messageId: messageDoc.messages[0]._id,
              aiMetadata: {
                model: botConfig?.config?.model || "gpt-4o-mini",
                tokens: 0,
                processingTimeMs: 0,
                fallbackUsed: false,
                timestamp: Date.now(),
                threadId: participant.threadId || "default",
              },
            });
          }

          console.log("🤖 Generic Bot: Successfully processed message");
        }
      }
    } catch (error) {
      console.error("🤖 AI Agent: Error in processIncomingMessage:", error);

      try {
        await ctx.runAction(api.whatsapp.sendMessage, {
          to: args.from,
          body: "Desculpe, houve um problema técnico. Tente novamente em alguns instantes.",
        });
      } catch (sendError) {
        console.error("🤖 AI Agent: Failed to send fallback message:", sendError);
      }
    }

    return null;
  },
});
