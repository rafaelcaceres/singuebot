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
