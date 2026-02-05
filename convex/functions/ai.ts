import { Agent, createTool } from "@convex-dev/agent";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { v } from "convex/values";
import { components } from "../_generated/api";
import { internal, api } from "../_generated/api";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { Id, Doc } from "../_generated/dataModel";

// Generic AI processing for multi-tenant system
export const processMessageWithGenericAI = internalAction({
  args: {
    messageId: v.id("genericMessages"),
    conversationId: v.id("genericConversations"),
    botId: v.id("bots"),
    tenantId: v.id("tenants"),
    userMessage: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      console.log(`🤖 Processing message with AI: ${args.messageId}`);

      // Get bot configuration
      const bot = await ctx.runQuery(internal.functions.ai.getBotConfiguration, {
        botId: args.botId,
      });

      if (!bot || !bot.isActive) {
        console.log(`❌ Bot not found or inactive: ${args.botId}`);
        return;
      }

      // Get conversation history
      const messages = await ctx.runQuery(internal.functions.messages.getConversationMessages, {
        conversationId: args.conversationId,
        limit: 10,
      });

      // Get tenant configuration for namespace
      const tenant = await ctx.runQuery(internal.functions.ai.getTenantConfiguration, {
        tenantId: args.tenantId,
      });

      let aiResponse = "";
      const usedTokens = 0;
      let processingTimeMs = 0;
      const startTime = Date.now();

      try {
        // Check if RAG is enabled
        if (bot.config?.enableRAG) {
          // Search knowledge base using tenant/bot specific namespace
          const relevantKnowledge = await ctx.runAction(internal.functions.genericRAG.searchKnowledgeForBot, {
            tenantSlug: tenant?.slug || 'default',
            botName: bot.name,
            query: args.userMessage,
            limit: 3,
          });

          // Generate AI response with RAG context
          aiResponse = await ctx.runAction(internal.functions.ai.generateResponseWithRAG, {
            userMessage: args.userMessage,
            conversationHistory: messages,
            botConfig: bot.config,
            knowledgeContext: relevantKnowledge,
          });
        } else {
          // Generate AI response without RAG
          aiResponse = await ctx.runAction(internal.functions.ai.generateResponse, {
            userMessage: args.userMessage,
            conversationHistory: messages,
            botConfig: bot.config,
          });
        }

        processingTimeMs = Date.now() - startTime;

        // Store AI response
        await ctx.runMutation(internal.functions.messages.storeOutboundMessage, {
          conversationId: args.conversationId,
          content: { text: aiResponse },
          direction: "outbound",
          status: "sent",
          aiMetadata: {
            processed: true,
            processedAt: Date.now(),
            model: bot.config?.model || "gpt-3.5-turbo",
            tokens: usedTokens,
            processingTimeMs,
            ragUsed: bot.config?.enableRAG || false,
            namespace: bot.config?.ragNamespace || "",
            fallbackUsed: false,
            timestamp: Date.now(),
          },
        });

        // Update original message with AI metadata
        await ctx.runMutation(internal.functions.ai.updateMessageAIMetadata, {
          messageId: args.messageId,
          aiMetadata: {
            processed: true,
            processedAt: Date.now(),
            model: bot.config?.model || "gpt-3.5-turbo",
            tokens: usedTokens,
            processingTimeMs,
            ragUsed: bot.config?.enableRAG || false,
            namespace: bot.config?.ragNamespace || "",
            fallbackUsed: false,
            timestamp: Date.now(),
          },
        });

      } catch (error) {
        console.error("❌ Error processing AI message:", error);
        
        // Store fallback message
        const fallbackMessage = bot.config?.fallbackMessage || "Sorry, I'm having trouble processing your message right now.";
        
        await ctx.runMutation(internal.functions.messages.storeOutboundMessage, {
          conversationId: args.conversationId,
          content: { text: fallbackMessage },
          direction: "outbound",
          status: "sent",
          aiMetadata: {
            processed: false,
            error: String(error),
            processedAt: Date.now(),
            model: bot.config?.model || "gpt-3.5-turbo",
            fallbackUsed: true,
            tokens: 0,
            processingTimeMs: Date.now() - startTime,
            timestamp: Date.now(),
          },
        });

        // Update original message with error metadata
        await ctx.runMutation(internal.functions.ai.updateMessageAIMetadata, {
          messageId: args.messageId,
          aiMetadata: {
            processed: false,
            error: String(error),
            processedAt: Date.now(),
            model: bot.config?.model || "gpt-3.5-turbo",
            fallbackUsed: true,
            tokens: 0,
            processingTimeMs: Date.now() - startTime,
            timestamp: Date.now(),
          },
        });
      }

    } catch (error) {
      console.error("❌ Error in processMessageWithGenericAI:", error);
    }
  },
});

// Get bot configuration
export const getBotConfiguration = internalQuery({
  args: {
    botId: v.id("bots"),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("bots"),
      name: v.string(),
      tenantId: v.id("tenants"),
      description: v.optional(v.string()),
      isActive: v.boolean(),
      config: v.object({
        personality: v.optional(v.string()),
        maxTokens: v.optional(v.number()),
        temperature: v.optional(v.number()),
        model: v.optional(v.string()),
        fallbackMessage: v.optional(v.string()),
        enableRAG: v.boolean(),
        ragNamespace: v.optional(v.string()),
      }),
    })
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.botId);
  },
});

// Get tenant configuration
export const getTenantConfiguration = internalQuery({
  args: {
    tenantId: v.id("tenants"),
  },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("tenants"),
      name: v.string(),
      slug: v.string(),
      isActive: v.boolean(),
      settings: v.object({
        timezone: v.string(),
        locale: v.string(),
        branding: v.optional(v.object({
          primaryColor: v.string(),
          logoUrl: v.optional(v.string()),
          companyName: v.string(),
        })),
      }),
    })
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.tenantId);
  },
});

// Search knowledge base with namespace support
export const searchKnowledge = internalAction({
  args: {
    query: v.string(),
    namespace: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.object({
    content: v.string(),
    score: v.number(),
    metadata: v.optional(v.any()),
  })),
  handler: async (ctx, args) => {
    try {
      const limit = args.limit || 5;
      
      // Use vector search to find relevant knowledge chunks
      const results: any[] = await ctx.vectorSearch("knowledge_chunks", "by_namespace_embedding", {
        vector: await ctx.runAction(internal.functions.ai.generateEmbedding, {
          text: args.query,
        }),
        limit,
        filter: (q) => q.eq("namespace", args.namespace),
      });

      return results.map((result: any) => ({
        content: result.content,
        score: result._score,
        metadata: result.metadata,
      }));

    } catch (error) {
      console.error("❌ Error searching knowledge:", error);
      return [];
    }
  },
});

// Generate embedding for text
export const generateEmbedding = internalAction({
  args: {
    text: v.string(),
  },
  returns: v.array(v.number()),
  handler: async (ctx, args) => {
    try {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: args.text,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data[0].embedding;

    } catch (error) {
      console.error("❌ Error generating embedding:", error);
      throw error;
    }
  },
});

// Generate AI response with RAG context
export const generateResponseWithRAG = internalAction({
  args: {
    userMessage: v.string(),
    conversationHistory: v.array(v.any()),
    botConfig: v.any(),
    knowledgeContext: v.array(v.object({
      content: v.string(),
      score: v.number(),
      metadata: v.optional(v.any()),
    })),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    try {
      // Build context from knowledge base
      const contextText = args.knowledgeContext
        .map((item: any) => item.content)
        .join("\n\n");

      // Build conversation history
      const conversationText = args.conversationHistory
        .slice(-5) // Last 5 messages
        .map((msg: any) => `${msg.direction === "inbound" ? "User" : "Assistant"}: ${msg.content?.text || msg.body}`)
        .join("\n");

      // Build system prompt
      const systemPrompt = `${args.botConfig?.systemPrompt || "You are a helpful AI assistant."}

Context from knowledge base:
${contextText}

Recent conversation:
${conversationText}

Please provide a helpful response based on the context and conversation history.`;

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: args.botConfig?.model || "gpt-3.5-turbo",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: args.userMessage },
          ],
          max_tokens: args.botConfig?.maxTokens || 500,
          temperature: args.botConfig?.temperature || 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const result = await response.json();
      return result.choices[0].message.content;

    } catch (error) {
      console.error("❌ Error generating response with RAG:", error);
      throw error;
    }
  },
});

// Generate AI response without RAG
export const generateResponse = internalAction({
  args: {
    userMessage: v.string(),
    conversationHistory: v.array(v.any()),
    botConfig: v.any(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    try {
      // Build conversation history
      const conversationText = args.conversationHistory
        .slice(-5) // Last 5 messages
        .map((msg: any) => `${msg.direction === "inbound" ? "User" : "Assistant"}: ${msg.content?.text || msg.body}`)
        .join("\n");

      // Build system prompt
      const systemPrompt = `${args.botConfig?.systemPrompt || "You are a helpful AI assistant."}

Recent conversation:
${conversationText}

Please provide a helpful response.`;

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: args.botConfig?.model || "gpt-3.5-turbo",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: args.userMessage },
          ],
          max_tokens: args.botConfig?.maxTokens || 500,
          temperature: args.botConfig?.temperature || 0.7,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
      }

      const result = await response.json();
      return result.choices[0].message.content;

    } catch (error) {
      console.error("❌ Error generating response:", error);
      throw error;
    }
  },
});

// Update message with AI metadata
export const updateMessageAIMetadata = internalMutation({
  args: {
    messageId: v.id("genericMessages"),
    aiMetadata: v.object({
      model: v.string(),
      tokens: v.number(),
      processingTimeMs: v.number(),
      fallbackUsed: v.boolean(),
      timestamp: v.number(),
      threadId: v.optional(v.string()),
      context: v.optional(v.any()),
      // Legacy fields for backward compatibility
      processed: v.optional(v.boolean()),
      processedAt: v.optional(v.number()),
      ragUsed: v.optional(v.boolean()),
      namespace: v.optional(v.string()),
      error: v.optional(v.string()),
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

// Get AI interactions for analytics
export const getAIInteractions = internalQuery({
  args: {
    tenantId: v.optional(v.id("tenants")),
    botId: v.optional(v.id("bots")),
    conversationId: v.optional(v.id("genericConversations")),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.object({
    _id: v.id("genericMessages"),
    _creationTime: v.number(),
    conversationId: v.id("genericConversations"),
    direction: v.string(),
    content: v.any(),
    aiMetadata: v.optional(v.any()),
  })),
  handler: async (ctx, args) => {
    const limit = args.limit || 50;

    let messages;

    if (args.conversationId) {
      messages = await ctx.db
        .query("genericMessages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId!))
        .order("desc")
        .take(limit);
    } else {
      messages = await ctx.db
        .query("genericMessages")
        .order("desc")
        .take(limit);
    }

    // Filter messages that have AI metadata
    return messages.filter((msg: any) => msg.aiMetadata !== undefined);
  },
});