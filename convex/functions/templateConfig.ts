import { v } from "convex/values";
import { internalMutation, mutation, query } from "../_generated/server";
import { PARTICIPANT_FIELDS } from "./participantFields";
import {
  deriveContentKey,
  extractBodyTokens,
  resolveTemplateVariables,
} from "./templateVariables";

/**
 * Template Configuration Functions
 * Manages HSM template configurations with variable mappings.
 */

const variableMappingValidator = v.object({
  templateVariable: v.string(),
  contentKey: v.optional(v.string()),
  participantField: v.string(),
  defaultValue: v.optional(v.string()),
  isRequired: v.boolean(),
});

export const configureTemplate = mutation({
  args: {
    templateId: v.optional(v.id("templates")),
    name: v.string(),
    locale: v.string(),
    twilioId: v.string(),
    stage: v.union(v.literal("draft"), v.literal("submitted"), v.literal("approved"), v.literal("rejected")),
    variableMappings: v.optional(v.array(variableMappingValidator)),
  },
  returns: v.id("templates"),
  handler: async (ctx, args) => {
    const existing = args.templateId ? await ctx.db.get(args.templateId) : null;

    // The variable list belongs to the Twilio sync, not to this form. This mutation
    // used to patch `variables: []` on every save, silently erasing the list the
    // send path and the composer both read from.
    const bodyTokens = extractBodyTokens(existing?.twilioStructure?.body);
    const knownVariables = existing?.variables ?? [];

    const mappings = args.variableMappings?.map((mapping, index) => ({
      ...mapping,
      contentKey:
        mapping.contentKey ??
        deriveContentKey(mapping.templateVariable, knownVariables, bodyTokens, index),
    }));

    if (args.templateId) {
      await ctx.db.patch(args.templateId, {
        name: args.name,
        locale: args.locale,
        twilioId: args.twilioId,
        stage: args.stage,
        ...(mappings ? { variableMappings: mappings } : {}),
      });
      return args.templateId;
    }

    return await ctx.db.insert("templates", {
      name: args.name,
      locale: args.locale,
      twilioId: args.twilioId,
      stage: args.stage,
      variables: [],
      ...(mappings ? { variableMappings: mappings } : {}),
    });
  },
});

/**
 * Upsert a template from the Twilio Content API sync.
 *
 * Matches on `twilioId` — never on name. Twilio friendly names are not unique
 * (commonly one per language), and twilio_db.createTemplate throws on duplicate
 * names, so a name-keyed sync would abort the whole run on the first collision.
 */
export const upsertSyncedTemplate = internalMutation({
  args: {
    twilioId: v.string(),
    friendlyName: v.string(),
    language: v.string(),
    contentType: v.optional(v.string()),
    approvalStatus: v.optional(v.string()),
    body: v.optional(v.string()),
    variables: v.array(v.string()),
    syncedAt: v.number(),
  },
  returns: v.object({
    templateId: v.id("templates"),
    outcome: v.union(
      v.literal("created"),
      v.literal("updated"),
      v.literal("created_with_suffix"),
    ),
    renamedLocally: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const twilioStructure = {
      friendlyName: args.friendlyName,
      language: args.language,
      variables: args.variables.map((key) => ({ key, type: "text" })),
      body: args.body,
      lastFetched: args.syncedAt,
    };

    const existing = await ctx.db
      .query("templates")
      .withIndex("by_twilio_id", (q) => q.eq("twilioId", args.twilioId))
      .first();

    if (existing) {
      // Never overwrite `name` — the admin may have renamed it locally on purpose.
      // Re-derive contentKey for any mapping that lacks one now that we know the body.
      const bodyTokens = extractBodyTokens(args.body);
      const mappings = existing.variableMappings?.map((mapping, index) => ({
        ...mapping,
        contentKey:
          mapping.contentKey ??
          deriveContentKey(mapping.templateVariable, args.variables, bodyTokens, index),
      }));

      await ctx.db.patch(existing._id, {
        locale: args.language,
        contentType: args.contentType,
        approvalStatus: args.approvalStatus,
        variables: args.variables,
        twilioStructure,
        syncedAt: args.syncedAt,
        ...(mappings ? { variableMappings: mappings } : {}),
      });

      return {
        templateId: existing._id,
        outcome: "updated" as const,
        renamedLocally: existing.name !== args.friendlyName,
      };
    }

    // No row for this SID. A row with the same name may still exist (a stale
    // hand-entered one, or the same template in another language). Disambiguate
    // rather than throwing, so one collision cannot abort the sync.
    const nameCollision = await ctx.db
      .query("templates")
      .withIndex("by_name", (q) => q.eq("name", args.friendlyName))
      .first();

    const name = nameCollision
      ? `${args.friendlyName} (${args.language})`
      : args.friendlyName;

    const templateId = await ctx.db.insert("templates", {
      name,
      locale: args.language,
      twilioId: args.twilioId,
      variables: args.variables,
      stage: "approved",
      contentType: args.contentType,
      approvalStatus: args.approvalStatus,
      twilioStructure,
      syncedAt: args.syncedAt,
    });

    return {
      templateId,
      outcome: nameCollision ? ("created_with_suffix" as const) : ("created" as const),
      renamedLocally: false,
    };
  },
});

/**
 * Mark templates that Twilio no longer returns. Never delete: past broadcasts
 * reference these rows for their history.
 */
export const archiveMissingTemplates = internalMutation({
  args: {
    seenTwilioIds: v.array(v.string()),
    syncedAt: v.number(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const seen = new Set(args.seenTwilioIds);
    const all = await ctx.db.query("templates").collect();
    let archived = 0;

    for (const template of all) {
      if (seen.has(template.twilioId)) continue;
      if (template.approvalStatus === "archived_remote") continue;
      // Only archive rows that a sync has touched before; leave purely local rows alone.
      if (!template.syncedAt) continue;
      await ctx.db.patch(template._id, { approvalStatus: "archived_remote" });
      archived += 1;
    }

    return archived;
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
      .withIndex("by_name", (q) => q.eq("name", args.templateName))
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
 * Get available participant fields for mapping.
 * Backed by the shared PARTICIPANT_FIELDS list so this stays in step with the
 * schema — it used to be a hardcoded seven fields that omitted email, cargo,
 * empresa and setor, i.e. exactly the fields the CSV import populates.
 */
export const getParticipantFields = query({
  args: {},
  returns: v.array(
    v.object({
      key: v.string(),
      label: v.string(),
      type: v.string(),
      group: v.string(),
    }),
  ),
  handler: async () => PARTICIPANT_FIELDS,
});

/**
 * Recompute a template's variable list from its synced body. Useful for rows
 * created before the sync existed.
 */
export const refreshTemplateVariables = internalMutation({
  args: { templateId: v.id("templates") },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.templateId);
    if (!template) throw new Error("Template não encontrado");

    const variables = resolveTemplateVariables(
      Object.fromEntries(
        (template.twilioStructure?.variables ?? []).map((entry) => [entry.key, entry.type]),
      ),
      template.twilioStructure?.body,
    );

    await ctx.db.patch(args.templateId, { variables });
    return variables;
  },
});
