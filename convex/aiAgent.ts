import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import { internal, api } from "./_generated/api";
import OpenAI from "openai";

// AI Agent configuration
const AI_AGENT_CONFIG = {
  name: "WhatsApp Assistant",
  personality: "You are a helpful WhatsApp assistant. Keep responses concise and friendly. Always be polite and professional.",
  maxTokens: 150,
  temperature: 0.7,
};

// FIB Interview configuration - Fabi persona
const FABI_CONFIG = {
  name: "Fabi - Future in Black Assistant",
  personality: `Você é a Fabi, assistente do Future in Black. Você é acolhedora, empática e focada em ajudar pessoas negras em sua jornada profissional. 
  
  Sua missão é conduzir entrevistas reflexivas baseadas na metodologia ASA (Ancestralidade, Sabedoria, Ascensão).
  
  Características da sua personalidade:
  - Calorosa e acolhedora
  - Usa linguagem inclusiva e empática  
  - Foca no empoderamento e crescimento
  - Faz perguntas reflexivas e profundas
  - Celebra conquistas e aprendizados
  
  Mantenha suas respostas concisas mas significativas.`,
  maxTokens: 200,
  temperature: 0.8,
};

// FIB Interview questions
const FIB_QUESTIONS = {
  Q1: "Olá! Sou a Fabi, sua assistente no Future in Black. Que bom que você aceitou participar! 🌟\n\nVamos começar nossa jornada de reflexão. Me conta: **Qual momento da sua trajetória profissional você considera mais transformador e por quê?**",
  Q2: "Que reflexão poderosa! 💫 Agora vamos pensar no presente: **Quais são os 3 principais desafios que você enfrenta hoje na sua carreira e como eles se conectam com sua identidade?**",
  Q3: "Muito obrigada por compartilhar isso comigo! 🙏 Para finalizar: **Onde você se vê daqui a 2 anos e que legado você quer deixar para outras pessoas negras que virão depois de você?**"
};

// Internal action to process incoming message with AI
export const processIncomingMessage = internalAction({
  args: {
    messageId: v.string(),
    from: v.string(),
    to: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      console.log("🤖 AI Agent: Processing incoming message:", args);
      
      // Check if this is a FIB interview trigger
      const isFibTrigger = args.body.toUpperCase().includes("ACEITO");
      
      if (isFibTrigger) {
        console.log("🎯 FIB Interview: Detected ACEITO trigger, starting FIB interview");
        return await handleFibInterview(ctx, args);
      }
      
      // Regular AI processing for non-FIB messages
      // Get conversation history for context
      const conversationHistory = await ctx.runQuery(
        internal.aiAgent.getConversationHistory,
        {
          phoneNumber: args.from,
          limit: 5,
        }
      );

      console.log("🤖 AI Agent: Conversation history:", conversationHistory);

      // Retrieve relevant knowledge context using RAG
      let knowledgeContext: any[] = [];
      try {
        knowledgeContext = await ctx.runAction(
          internal.functions.rag_actions.retrieve,
          {
            query: args.body,
            topK: 3, // Get top 3 most relevant chunks
          }
        );
        console.log("🤖 AI Agent: Retrieved knowledge context:", knowledgeContext.length, "chunks");
      } catch (error) {
        console.log("🤖 AI Agent: No knowledge context available:", error);
      }

      // Generate AI response with knowledge context
      const aiResponse = await generateAIResponse(args.body, conversationHistory, knowledgeContext);
      console.log("🤖 AI Agent: Generated AI response:", aiResponse);

      if (aiResponse) {
        console.log("🤖 AI Agent: Sending response to", args.from);
        // Send the AI response back to the user
        await ctx.runAction(api.whatsapp.sendMessage, {
          to: args.from,
          body: aiResponse,
        });

        // Log the AI interaction
        const interactionId = await ctx.runMutation(internal.aiAgent.logAIInteraction, {
          originalMessageId: args.messageId,
          userMessage: args.body,
          aiResponse: aiResponse,
          phoneNumber: args.from,
        });
        console.log("🤖 AI Agent: Successfully processed and responded. Interaction logged:", interactionId);
      } else {
        console.log("🤖 AI Agent: No response generated");
      }
    } catch (error) {
      console.error("🤖 AI Agent: Error processing message with AI:", error);
      
      // Send a fallback response
      try {
        await ctx.runAction(api.whatsapp.sendMessage, {
          to: args.from,
          body: "I'm sorry, I'm having trouble processing your message right now. Please try again later.",
        });
      } catch (fallbackError) {
        console.error("Error sending fallback response:", fallbackError);
      }
    }
  },
});

// Handle FIB interview flow
async function handleFibInterview(ctx: any, args: any) {
  try {
    console.log("🎯 FIB Interview: Starting interview flow for", args.from);
    
    // Get or create participant
    const participant = await ctx.runMutation(internal.functions.twilio_db.getOrCreateParticipant, {
      phone: args.from,
    });
    
    // Update consent to true for FIB participants
    await ctx.runMutation(internal.functions.twilio_db.updateParticipantConsent, {
      participantId: participant._id,
      consent: true,
    });
    
    // Get or create interview session
    const session = await ctx.runQuery(internal.functions.interview.startOrResumeSession, {
      participantId: participant._id,
    });
    
    if (!session) {
      console.log("🎯 FIB Interview: Creating new session");
      const sessionId = await ctx.runMutation(internal.functions.interview.createSession, {
        participantId: participant._id,
      });
      
      // Start with Q1
      await ctx.runMutation(internal.functions.interview.updateSession, {
        sessionId: sessionId,
        step: "FIB_Q1",
        answers: {},
      });
      
      // Send first question
      await ctx.runAction(api.whatsapp.sendMessage, {
        to: args.from,
        body: FIB_QUESTIONS.Q1,
      });
      
      console.log("🎯 FIB Interview: Started with Q1");
      return;
    }
    
    // Handle existing session - determine next step
    const currentStep = session.step;
    console.log("🎯 FIB Interview: Current step:", currentStep);
    
    let nextStep = "";
    let responseMessage = "";
    
    switch (currentStep) {
      case "FIB_Q1":
        nextStep = "FIB_Q2";
        responseMessage = FIB_QUESTIONS.Q2;
        break;
      case "FIB_Q2":
        nextStep = "FIB_Q3";
        responseMessage = FIB_QUESTIONS.Q3;
        break;
      case "FIB_Q3":
        nextStep = "FIB_DONE";
        responseMessage = "Muito obrigada por compartilhar sua jornada comigo! 🌟 Suas reflexões são muito valiosas. A equipe do Future in Black entrará em contato em breve com os próximos passos. Continue brilhando! ✨";
        break;
      default:
        // If already done or unknown state, restart
        nextStep = "FIB_Q1";
        responseMessage = FIB_QUESTIONS.Q1;
    }
    
    // Update session with user's answer and new step
    const updatedAnswers = {
      ...session.answers,
      [currentStep]: args.body,
    };
    
    await ctx.runMutation(internal.functions.interview.updateSession, {
      sessionId: session._id,
      step: nextStep,
      answers: updatedAnswers,
    });
    
    // Send response
    await ctx.runAction(api.whatsapp.sendMessage, {
      to: args.from,
      body: responseMessage,
    });
    
    // Log the interaction
    await ctx.runMutation(internal.aiAgent.logAIInteraction, {
      originalMessageId: args.messageId,
      userMessage: args.body,
      aiResponse: responseMessage,
      phoneNumber: args.from,
    });
    
    console.log("🎯 FIB Interview: Advanced to step:", nextStep);
    
  } catch (error) {
    console.error("🎯 FIB Interview: Error in interview flow:", error);
    
    // Send fallback message
    await ctx.runAction(api.whatsapp.sendMessage, {
      to: args.from,
      body: "Ops! Tive um probleminha técnico. Pode tentar novamente? 😊",
    });
  }
}

// Internal query to get conversation history
export const getConversationHistory = internalQuery({
  args: {
    phoneNumber: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 5;
    
    // Get recent messages from this phone number
    const messages = await ctx.db
      .query("whatsappMessages")
      .filter((q) => 
        q.or(
          q.eq(q.field("from"), args.phoneNumber),
          q.eq(q.field("to"), args.phoneNumber)
        )
      )
      .order("desc")
      .take(limit * 2); // Get more to ensure we have enough context

    // Format messages for AI context
    return messages
      .reverse() // Chronological order
      .map((msg) => ({
        role: msg.direction === "inbound" ? "user" : "assistant",
        content: msg.body,
        timestamp: msg._creationTime,
      }))
      .slice(-limit); // Keep only the most recent
  },
});

// Internal mutation to log AI interactions
export const logAIInteraction = internalMutation({
  args: {
    originalMessageId: v.string(),
    userMessage: v.string(),
    aiResponse: v.string(),
    phoneNumber: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("aiInteractions", {
      originalMessageId: args.originalMessageId,
      userMessage: args.userMessage,
      aiResponse: args.aiResponse,
      phoneNumber: args.phoneNumber,
      timestamp: Date.now(),
    });
  },
});

// Helper function to generate AI response
async function generateAIResponse(
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string; timestamp: number }>,
  knowledgeContext?: any[]
): Promise<string | null> {
  try {
    // Initialize OpenAI with Convex credentials or user's own
    const openai = new OpenAI({
      baseURL: process.env.CONVEX_OPENAI_BASE_URL || undefined,
      apiKey: process.env.CONVEX_OPENAI_API_KEY || process.env.OPENAI_API_KEY,
    });

    // Build context from knowledge base if available
    let contextPrompt = "";
    if (knowledgeContext && knowledgeContext.length > 0) {
      const contextText = knowledgeContext
        .map(chunk => chunk.chunk)
        .join("\n\n");
      contextPrompt = `\n\nRelevant knowledge context:\n${contextText}\n\nUse this context to provide accurate and helpful responses when relevant.`;
    }

    // Build conversation context
    const messages = [
      {
        role: "system" as const,
        content: `${AI_AGENT_CONFIG.personality}${contextPrompt}
Current time: ${new Date().toLocaleString()}
Keep responses under 160 characters when possible for WhatsApp.`,
      },
      // Add conversation history
      ...conversationHistory.map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      })),
      // Add current user message
      {
        role: "user" as const,
        content: userMessage,
      },
    ];

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-nano",
      messages: messages,
      max_tokens: AI_AGENT_CONFIG.maxTokens,
      temperature: AI_AGENT_CONFIG.temperature,
    });

    return completion.choices[0]?.message?.content || null;
  } catch (error) {
    console.error("Error generating AI response:", error);
    return null;
  }
}

// Query to get AI interaction history (for dashboard)
export const getAIInteractions = query({
  args: {
    phoneNumber: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    
    let query = ctx.db.query("aiInteractions");
    
    if (args.phoneNumber) {
      query = query.filter((q) => q.eq(q.field("phoneNumber"), args.phoneNumber));
    }
    
    return await query.order("desc").take(limit);
  },
});
