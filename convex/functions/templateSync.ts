"use node";

import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { twilioAuthHeader } from "../lib/twilioClient";
import { resolveTemplateVariables } from "./templateVariables";

/**
 * Sync HSM templates from the Twilio Content API into the `templates` table.
 *
 * Uses /v1/ContentAndApprovals rather than /v1/Content: it returns the content and
 * its WhatsApp approval status in one paginated list, where /v1/Content would force
 * an N+1 against /Content/{sid}/ApprovalRequests per template.
 *
 * The mapper is deliberately tolerant — Twilio nests approval status differently
 * across content types, and a shape surprise should degrade one field rather than
 * abort the run.
 */

const MAX_PAGES = 40;
const PAGE_SIZE = 50;

interface TwilioContent {
  sid?: string;
  friendly_name?: string;
  language?: string;
  variables?: Record<string, unknown>;
  types?: Record<string, { body?: string }>;
  approval_requests?: unknown;
}

/** Twilio reports approval either flat or nested under the channel. Handle both. */
function extractApprovalStatus(approvalRequests: unknown): string | undefined {
  if (!approvalRequests || typeof approvalRequests !== "object") return undefined;
  const record = approvalRequests as Record<string, any>;

  if (typeof record.status === "string") return record.status;
  if (record.whatsapp && typeof record.whatsapp.status === "string") {
    return record.whatsapp.status;
  }
  return undefined;
}

/** The first entry of `types` is the content type; its `body` is the template text. */
function extractTypeAndBody(types: TwilioContent["types"]): {
  contentType?: string;
  body?: string;
} {
  if (!types || typeof types !== "object") return {};
  const [contentType] = Object.keys(types);
  if (!contentType) return {};
  return { contentType, body: types[contentType]?.body };
}

interface SyncConflict {
  twilioId: string;
  friendlyName: string;
  reason: string;
}

interface SyncResult {
  scanned: number;
  created: number;
  updated: number;
  archived: number;
  conflicts: SyncConflict[];
}

const syncResultValidator = v.object({
  scanned: v.number(),
  created: v.number(),
  updated: v.number(),
  archived: v.number(),
  conflicts: v.array(
    v.object({
      twilioId: v.string(),
      friendlyName: v.string(),
      reason: v.string(),
    }),
  ),
});

/** Authenticated entry point used by the Templates page. */
export const syncTemplatesFromTwilio = action({
  args: {},
  returns: syncResultValidator,
  handler: async (ctx): Promise<SyncResult> => {
    await ctx.runQuery(internal.lib.requireOrganizer.assertOrganizer, {
      minimumRole: "editor",
    });
    return await ctx.runAction(internal.functions.templateSync.runTemplateSync, {});
  },
});

export const runTemplateSync = internalAction({
  args: {},
  returns: syncResultValidator,
  handler: async (ctx): Promise<SyncResult> => {
    const syncedAt = Date.now();
    const conflicts: SyncConflict[] = [];
    const seenTwilioIds: string[] = [];
    let created = 0;
    let updated = 0;
    let scanned = 0;

    let url: string | null =
      `https://content.twilio.com/v1/ContentAndApprovals?PageSize=${PAGE_SIZE}`;
    let page = 0;

    while (url && page < MAX_PAGES) {
      const response: Response = await fetch(url, {
        method: "GET",
        headers: { Authorization: twilioAuthHeader() },
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(
          `Erro ao listar templates no Twilio: ${response.status} ${body}`,
        );
      }

      const payload: any = await response.json();
      const contents: TwilioContent[] = payload.contents ?? [];

      for (const content of contents) {
        if (!content.sid) continue;
        scanned += 1;
        seenTwilioIds.push(content.sid);

        const { contentType, body } = extractTypeAndBody(content.types);
        const variables = resolveTemplateVariables(content.variables, body);
        const friendlyName = content.friendly_name ?? content.sid;

        const result: {
          outcome: "created" | "updated" | "created_with_suffix";
          renamedLocally: boolean;
        } = await ctx.runMutation(
          internal.functions.templateConfig.upsertSyncedTemplate,
          {
            twilioId: content.sid,
            friendlyName,
            language: content.language ?? "pt_BR",
            contentType,
            approvalStatus: extractApprovalStatus(content.approval_requests),
            body,
            variables,
            syncedAt,
          },
        );

        if (result.outcome === "created") created += 1;
        if (result.outcome === "updated") updated += 1;
        if (result.outcome === "created_with_suffix") {
          created += 1;
          conflicts.push({
            twilioId: content.sid,
            friendlyName,
            reason:
              "Já existia um template local com este nome. Criado com o idioma no nome — verifique se o antigo ainda é necessário.",
          });
        }
        if (result.renamedLocally) {
          conflicts.push({
            twilioId: content.sid,
            friendlyName,
            reason: `O nome local difere do nome no Twilio ("${friendlyName}"). O nome local foi preservado.`,
          });
        }
      }

      url = typeof payload?.meta?.next_page_url === "string"
        ? payload.meta.next_page_url
        : null;
      page += 1;
    }

    if (page >= MAX_PAGES && url) {
      conflicts.push({
        twilioId: "-",
        friendlyName: "-",
        reason: `A sincronização parou em ${MAX_PAGES} páginas. Alguns templates podem não ter sido lidos.`,
      });
    }

    const archived: number = await ctx.runMutation(
      internal.functions.templateConfig.archiveMissingTemplates,
      { seenTwilioIds, syncedAt },
    );

    return { scanned, created, updated, archived, conflicts };
  },
});
