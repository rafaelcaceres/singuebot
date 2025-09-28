import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * Template Configuration Functions
 * Manages HSM template configurations with variable mappings
 */

export const configureTemplate = mutation({
  args: {
    templateId: v.optional(v.id("templates")),
    name: v.string(),
    locale: v.string(),
    twilioId: v.string(),
    stage: v.union(v.literal("draft"), v.literal("submitted"), v.literal("approved"), v.literal("rejected")),
    variableMappings: v.optional(v.array(v.object({
      templateVariable: v.string(),
      participantField: v.string(),
      defaultValue: v.optional(v.string()),
      isRequired: v.boolean(),
    }))),
  },
  handler: async (ctx, args) => {
    const templateData = {
      name: args.name,
      locale: args.locale,
      twilioId: args.twilioId,
      stage: args.stage,
      variables: [], // Will be populated when template structure is fetched
      variableMappings: args.variableMappings || [],
    };

    if (args.templateId) {
      // Update existing template
      await ctx.db.patch(args.templateId, templateData);
      return args.templateId;
    } else {
      // Create new template
      return await ctx.db.insert("templates", templateData);
    }
  },
});

/**
 * Get template configuration by ID
 */
export const getTemplateConfig = query({
  args: { templateId: v.id("templates") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.templateId);
  },
});

/**
 * Get template configuration by name
 */
export const getTemplateConfigByName = query({
  args: { templateName: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("templates")
      .filter((q) => q.eq(q.field("name"), args.templateName))
      .first();
  },
});

/**
 * List template configurations
 */
export const listTemplates = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("templates").collect();
  },
});

/**
 * Get available participant fields for mapping
 */
export const getParticipantFields = query({
  args: {},
  handler: async (ctx) => {
    // Return the available fields from the participants table
    return [
      { key: "phone", label: "Phone Number", type: "string" },
      { key: "name", label: "Name", type: "string" },
      { key: "consent", label: "Consent Status", type: "boolean" },
      { key: "clusterId", label: "Cluster ID", type: "string" },
      { key: "tags", label: "Tags", type: "array" },
      { key: "createdAt", label: "Created At", type: "number" },
      { key: "threadId", label: "Thread ID", type: "string" },
    ];
  },
});