import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  MutationCtx,
} from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { requireOrganizer } from "../lib/requireOrganizer";
import {
  deriveContentKey,
  extractBodyTokens,
  renderTemplateBody,
  resolveContentVariables,
  ResolvedMapping,
} from "./templateVariables";
import { formatParticipantFieldValue } from "./participantFields";
import { normalizePhoneNumber } from "../utils/phoneNormalizer";

/**
 * Broadcast engine (disparo em massa).
 *
 * Runs as a self-chaining serial worker: enqueue -> claim a batch -> send with a
 * throttle -> record results -> schedule the next tick. Serial is deliberate; the
 * throttle is the point, and parallel chains would turn the counter patch on the
 * broadcast document into a contended hot doc.
 *
 * The Node-side sender lives in functions/broadcastSender.ts.
 */

const ENQUEUE_CHUNK = 300;
const DEFAULT_RATE_PER_SECOND = 5;
const MAX_RATE_PER_SECOND = 20;
const DEFAULT_BATCH_SIZE = 20;
const MAX_ATTEMPTS = 2;
const STALE_CLAIM_MS = 5 * 60 * 1000;
const MAX_IDS_SELECTION = 5000;

const mappingInputValidator = v.object({
  templateVariable: v.string(),
  participantField: v.optional(v.string()),
  defaultValue: v.optional(v.string()),
  isRequired: v.boolean(),
});

const selectionValidator = v.union(
  v.object({
    mode: v.literal("ids"),
    participantIds: v.array(v.id("participants")),
  }),
  v.object({
    mode: v.literal("filter"),
    clusterId: v.optional(v.id("clusters")),
    importSource: v.optional(v.string()),
    consentOnly: v.optional(v.boolean()),
  }),
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Attach the literal Twilio ContentVariables key to each mapping, derived from the
 * template body. Doing this once at creation is what keeps the send path dumb.
 */
function buildMappings(
  template: Doc<"templates">,
  inputs: Array<{
    templateVariable: string;
    participantField?: string;
    defaultValue?: string;
    isRequired: boolean;
  }>,
): ResolvedMapping[] {
  const bodyTokens = extractBodyTokens(template.twilioStructure?.body);
  return inputs.map((input, index) => ({
    contentKey: deriveContentKey(
      input.templateVariable,
      template.variables ?? [],
      bodyTokens,
      index,
    ),
    templateVariable: input.templateVariable,
    participantField: input.participantField,
    defaultValue: input.defaultValue,
    isRequired: input.isRequired,
  }));
}

/**
 * Fall back to the template's own configuration when the composer does not send
 * an explicit mapping, so a template configured on the Templates page still works.
 */
function defaultMappingInputs(template: Doc<"templates">) {
  if (template.variableMappings?.length) {
    return template.variableMappings.map((mapping) => ({
      templateVariable: mapping.templateVariable,
      participantField: mapping.participantField,
      defaultValue: mapping.defaultValue,
      isRequired: mapping.isRequired,
    }));
  }
  return (template.variables ?? []).map((variable) => ({
    templateVariable: variable,
    participantField: undefined,
    defaultValue: undefined,
    isRequired: true,
  }));
}

/** A number we are willing to hand to Twilio. */
function isSendablePhone(phone: string): boolean {
  const digits = phone.replace(/^whatsapp:/, "").replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

/**
 * Optional test allowlist. Enforced here in the mutation rather than only in the
 * action, so it cannot be bypassed by invoking the sender directly.
 */
function allowlist(): Set<string> | null {
  const raw = process.env.TWILIO_TEST_ALLOWLIST;
  if (!raw || !raw.trim()) return null;
  return new Set(
    raw
      .split(",")
      .map((entry) => normalizePhoneNumber(entry.trim()))
      .filter(Boolean),
  );
}

async function patchCounters(
  ctx: MutationCtx,
  broadcastId: Id<"broadcasts">,
  delta: { sent?: number; failed?: number; skipped?: number; total?: number },
) {
  const broadcast = await ctx.db.get(broadcastId);
  if (!broadcast) return;
  await ctx.db.patch(broadcastId, {
    sentCount: broadcast.sentCount + (delta.sent ?? 0),
    failedCount: broadcast.failedCount + (delta.failed ?? 0),
    skippedCount: broadcast.skippedCount + (delta.skipped ?? 0),
    total: broadcast.total + (delta.total ?? 0),
    lastHeartbeatAt: Date.now(),
  });
}

// ---------------------------------------------------------------------------
// Preview — the acceptance test for the variable mapping
// ---------------------------------------------------------------------------

export const previewBroadcast = query({
  args: {
    templateId: v.id("templates"),
    participantIds: v.array(v.id("participants")),
    mappings: v.optional(v.array(mappingInputValidator)),
    overrides: v.optional(v.record(v.string(), v.string())),
  },
  returns: v.object({
    templateName: v.string(),
    body: v.optional(v.string()),
    approvalStatus: v.optional(v.string()),
    rows: v.array(
      v.object({
        participantId: v.id("participants"),
        name: v.optional(v.string()),
        phone: v.string(),
        contentVariables: v.record(v.string(), v.string()),
        renderedBody: v.string(),
        missingRequired: v.array(v.string()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    await requireOrganizer(ctx, "viewer");
    const template = await ctx.db.get(args.templateId);
    if (!template) throw new Error("Template não encontrado");

    const mappings = buildMappings(
      template,
      args.mappings ?? defaultMappingInputs(template),
    );
    const body = template.twilioStructure?.body;

    const rows = [];
    for (const participantId of args.participantIds.slice(0, 5)) {
      const participant = await ctx.db.get(participantId);
      if (!participant) continue;

      const { contentVariables, missingRequired } = resolveContentVariables(
        mappings,
        participant as unknown as Record<string, unknown>,
        args.overrides,
        formatParticipantFieldValue,
      );

      rows.push({
        participantId,
        name: participant.name,
        phone: participant.phone,
        contentVariables,
        renderedBody: renderTemplateBody(body, contentVariables),
        missingRequired,
      });
    }

    return {
      templateName: template.name,
      body,
      approvalStatus: template.approvalStatus,
      rows,
    };
  },
});

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

const createBroadcastArgs = {
  templateId: v.id("templates"),
  label: v.optional(v.string()),
  selection: selectionValidator,
  mappings: v.optional(v.array(mappingInputValidator)),
  overrides: v.optional(v.record(v.string(), v.string())),
  ratePerSecond: v.optional(v.number()),
  dryRun: v.boolean(),
};

/**
 * Public entry point: policy only (who may send, and is the feature on).
 * The mechanism lives in createBroadcastInternal.
 */
/**
 * Resolve one approved template against one participant, for the operator inbox.
 *
 * Outside the WhatsApp 24-hour window a free-form reply silently fails, so the
 * composer falls back to sending a template. Same resolution rules as a
 * broadcast — one recipient instead of thousands.
 */
export const resolveTemplateForParticipant = internalQuery({
  args: {
    templateId: v.id("templates"),
    participantId: v.id("participants"),
    overrides: v.optional(v.record(v.string(), v.string())),
  },
  // Explicit, because the operator inbox calls this across a module cycle and
  // TypeScript cannot infer the shape through it.
  returns: v.object({
    templateName: v.string(),
    contentSid: v.string(),
    contentVariables: v.record(v.string(), v.string()),
    missingRequired: v.array(v.string()),
    renderedBody: v.optional(v.string()),
    phone: v.string(),
  }),
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.templateId);
    if (!template) throw new Error("Template não encontrado");
    if (template.approvalStatus !== "approved") {
      throw new Error(
        `Template "${template.name}" não está aprovado no Twilio e não pode ser enviado.`,
      );
    }
    if (!template.twilioId) {
      throw new Error(`Template "${template.name}" não tem ContentSid.`);
    }

    const participant = await ctx.db.get(args.participantId);
    if (!participant) throw new Error("Participante não encontrado");

    const mappings = buildMappings(template, defaultMappingInputs(template));
    const { contentVariables, missingRequired } = resolveContentVariables(
      mappings,
      participant as unknown as Record<string, unknown>,
      args.overrides,
      formatParticipantFieldValue,
    );

    return {
      templateName: template.name,
      contentSid: template.twilioId,
      contentVariables,
      missingRequired,
      renderedBody: renderTemplateBody(template.twilioStructure?.body, contentVariables),
      phone: participant.phone,
    };
  },
});

export const createBroadcast = mutation({
  args: createBroadcastArgs,
  returns: v.id("broadcasts"),
  handler: async (ctx, args): Promise<Id<"broadcasts">> => {
    const organizer = await requireOrganizer(ctx, "editor");

    // Feature flag is checked server-side: a client-only flag stops nobody.
    const bot = await ctx.db
      .query("bots")
      .withIndex("by_active", (q) => q.eq("isActive", true))
      .first();
    if (!bot?.config?.enableBroadcasts) {
      throw new Error(
        "Disparo em massa está desativado. Ative em Configurações antes de continuar.",
      );
    }

    return await ctx.runMutation(
      internal.functions.broadcasts.createBroadcastInternal,
      { ...args, createdByEmail: organizer.email },
    );
  },
});

export const createBroadcastInternal = internalMutation({
  args: { ...createBroadcastArgs, createdByEmail: v.optional(v.string()) },
  returns: v.id("broadcasts"),
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.templateId);
    if (!template) throw new Error("Template não encontrado");
    if (template.approvalStatus && template.approvalStatus !== "approved") {
      throw new Error(
        `O template "${template.name}" não está aprovado no WhatsApp (status: ${template.approvalStatus}).`,
      );
    }

    if (
      args.selection.mode === "ids" &&
      args.selection.participantIds.length > MAX_IDS_SELECTION
    ) {
      throw new Error(
        `Seleção muito grande (${args.selection.participantIds.length}). Acima de ${MAX_IDS_SELECTION} use a seleção por filtro.`,
      );
    }

    const mappings = buildMappings(
      template,
      args.mappings ?? defaultMappingInputs(template),
    );

    const rate = Math.min(
      Math.max(args.ratePerSecond ?? DEFAULT_RATE_PER_SECOND, 1),
      MAX_RATE_PER_SECOND,
    );

    const broadcastId = await ctx.db.insert("broadcasts", {
      label: args.label?.trim() || template.name,
      templateId: args.templateId,
      contentSid: template.twilioId,
      templateName: template.name,
      templateBody: template.twilioStructure?.body,
      mappingsSnapshot: mappings,
      overrides: args.overrides,
      selection: args.selection,
      enqueueCursor: null,
      enqueueOffset: 0,
      status: "enqueueing",
      total: 0,
      sentCount: 0,
      failedCount: 0,
      skippedCount: 0,
      ratePerSecond: rate,
      batchSize: DEFAULT_BATCH_SIZE,
      dryRun: args.dryRun,
      createdByEmail: args.createdByEmail,
      createdAt: Date.now(),
      lastHeartbeatAt: Date.now(),
    });

    // Transactional: the schedule commits with the insert or not at all.
    await ctx.scheduler.runAfter(0, internal.functions.broadcasts.enqueueRecipients, {
      broadcastId,
    });

    return broadcastId;
  },
});

// ---------------------------------------------------------------------------
// Enqueue — chunked and resumable
// ---------------------------------------------------------------------------

export const enqueueRecipients = internalMutation({
  args: { broadcastId: v.id("broadcasts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const broadcast = await ctx.db.get(args.broadcastId);
    if (!broadcast) return null;
    if (broadcast.status !== "enqueueing") return null;

    const allowed = allowlist();
    let participants: Doc<"participants">[] = [];
    let isDone = false;
    let nextCursor: string | null = null;
    let nextOffset = broadcast.enqueueOffset ?? 0;

    if (broadcast.selection.mode === "ids") {
      const ids = broadcast.selection.participantIds;
      const slice = ids.slice(nextOffset, nextOffset + ENQUEUE_CHUNK);
      for (const id of slice) {
        const participant = await ctx.db.get(id);
        if (participant) participants.push(participant);
      }
      nextOffset += slice.length;
      isDone = nextOffset >= ids.length;
    } else {
      const filter = broadcast.selection;
      const cursor = broadcast.enqueueCursor ?? null;

      if (filter.importSource) {
        // Via the membership table so people who already existed when the CSV
        // was imported are included, not only the ones it created.
        const importSource = filter.importSource;
        const page = await ctx.db
          .query("participantImports")
          .withIndex("by_import_source", (q) => q.eq("importSource", importSource))
          .paginate({ numItems: ENQUEUE_CHUNK, cursor });

        for (const membership of page.page) {
          const participant = await ctx.db.get(membership.participantId);
          if (!participant) continue;
          if (filter.clusterId && participant.clusterId !== filter.clusterId) continue;
          participants.push(participant);
        }
        isDone = page.isDone;
        nextCursor = page.continueCursor;
      } else {
        const page = filter.clusterId
          ? await ctx.db
              .query("participants")
              .withIndex("by_cluster", (q) => q.eq("clusterId", filter.clusterId))
              .paginate({ numItems: ENQUEUE_CHUNK, cursor })
          : await ctx.db
              .query("participants")
              .withIndex("by_created")
              .paginate({ numItems: ENQUEUE_CHUNK, cursor });

        participants = page.page;
        isDone = page.isDone;
        nextCursor = page.continueCursor;
      }

      if (filter.consentOnly) {
        participants = participants.filter((p) => p.consent);
      }
    }

    let added = 0;
    let skipped = 0;

    for (const participant of participants) {
      const phone = normalizePhoneNumber(participant.phone);

      // Dedupe within this broadcast. Indexed lookup, so it stays cheap across chunks.
      const duplicate = await ctx.db
        .query("broadcastRecipients")
        .withIndex("by_broadcast_phone", (q) =>
          q.eq("broadcastId", args.broadcastId).eq("phone", phone),
        )
        .first();

      let skipReason: string | undefined;
      if (duplicate) {
        skipReason = "duplicate_phone";
      } else if (!isSendablePhone(phone)) {
        skipReason = "invalid_phone";
      } else if (allowed && !allowed.has(phone)) {
        skipReason = "not_in_allowlist";
      }

      // A skipped duplicate still gets a row (with its real phone) so the operator
      // can see why the recipient count differs from the selection count. The
      // by_broadcast_phone index is non-unique, so the extra row is harmless — any
      // hit means "this number is already handled in this broadcast".
      const { contentVariables } = skipReason
        ? { contentVariables: {} }
        : resolveContentVariables(
            broadcast.mappingsSnapshot,
            participant as unknown as Record<string, unknown>,
            broadcast.overrides,
            formatParticipantFieldValue,
          );

      await ctx.db.insert("broadcastRecipients", {
        broadcastId: args.broadcastId,
        participantId: participant._id,
        phone,
        contentVariables,
        status: skipReason ? "skipped" : "pending",
        attempts: 0,
        skipReason,
      });

      added += 1;
      if (skipReason) skipped += 1;
    }

    await ctx.db.patch(args.broadcastId, {
      total: broadcast.total + added,
      skippedCount: broadcast.skippedCount + skipped,
      enqueueCursor: nextCursor,
      enqueueOffset: nextOffset,
      lastHeartbeatAt: Date.now(),
    });

    if (!isDone) {
      await ctx.scheduler.runAfter(0, internal.functions.broadcasts.enqueueRecipients, {
        broadcastId: args.broadcastId,
      });
      return null;
    }

    await ctx.db.patch(args.broadcastId, {
      status: "running",
      startedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(
      0,
      internal.functions.broadcastSender.runBroadcastBatch,
      { broadcastId: args.broadcastId },
    );
    return null;
  },
});

// ---------------------------------------------------------------------------
// Worker support
// ---------------------------------------------------------------------------

export const claimNextBatch = internalMutation({
  args: { broadcastId: v.id("broadcasts") },
  returns: v.object({
    stop: v.boolean(),
    exhausted: v.boolean(),
    gapMs: v.number(),
    dryRun: v.boolean(),
    contentSid: v.string(),
    templateName: v.string(),
    items: v.array(
      v.object({
        recipientId: v.id("broadcastRecipients"),
        participantId: v.id("participants"),
        phone: v.string(),
        contentVariables: v.record(v.string(), v.string()),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const broadcast = await ctx.db.get(args.broadcastId);
    const empty = {
      stop: true,
      exhausted: false,
      gapMs: 0,
      dryRun: true,
      contentSid: "",
      templateName: "",
      items: [] as Array<{
        recipientId: Id<"broadcastRecipients">;
        participantId: Id<"participants">;
        phone: string;
        contentVariables: Record<string, string>;
      }>,
    };
    if (!broadcast) return empty;

    // Pause and cancel need no cross-process signalling: the worker asks here.
    if (broadcast.status !== "running") {
      return {
        ...empty,
        dryRun: broadcast.dryRun,
        contentSid: broadcast.contentSid,
        templateName: broadcast.templateName,
      };
    }

    const pending = await ctx.db
      .query("broadcastRecipients")
      .withIndex("by_broadcast_status", (q) =>
        q.eq("broadcastId", args.broadcastId).eq("status", "pending"),
      )
      .take(broadcast.batchSize);

    if (pending.length === 0) {
      return {
        ...empty,
        stop: false,
        exhausted: true,
        dryRun: broadcast.dryRun,
        contentSid: broadcast.contentSid,
        templateName: broadcast.templateName,
      };
    }

    const now = Date.now();
    const allowed = allowlist();
    const items = [];
    let skipped = 0;

    for (const recipient of pending) {
      if (allowed && !allowed.has(recipient.phone)) {
        await ctx.db.patch(recipient._id, {
          status: "skipped",
          skipReason: "not_in_allowlist",
        });
        skipped += 1;
        continue;
      }

      // Flipping to "sending" inside this transaction is what makes the claim
      // exclusive: two chains physically cannot take the same recipient.
      await ctx.db.patch(recipient._id, {
        status: "sending",
        claimedAt: now,
        attempts: recipient.attempts + 1,
      });

      items.push({
        recipientId: recipient._id,
        participantId: recipient.participantId,
        phone: recipient.phone,
        contentVariables: recipient.contentVariables,
      });
    }

    if (skipped > 0) {
      await patchCounters(ctx, args.broadcastId, { skipped });
    } else {
      await ctx.db.patch(args.broadcastId, { lastHeartbeatAt: now });
    }

    return {
      stop: false,
      exhausted: false,
      gapMs: Math.round(1000 / broadcast.ratePerSecond),
      dryRun: broadcast.dryRun,
      contentSid: broadcast.contentSid,
      templateName: broadcast.templateName,
      items,
    };
  },
});

export const recordBatchResults = internalMutation({
  args: {
    broadcastId: v.id("broadcasts"),
    results: v.array(
      v.object({
        recipientId: v.id("broadcastRecipients"),
        outcome: v.union(v.literal("sent"), v.literal("failed"), v.literal("retry")),
        messageSid: v.optional(v.string()),
        errorCode: v.optional(v.number()),
        errorMessage: v.optional(v.string()),
      }),
    ),
    nextDelayMs: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    let sent = 0;
    let failed = 0;

    for (const result of args.results) {
      const recipient = await ctx.db.get(result.recipientId);
      if (!recipient) continue;

      if (result.outcome === "sent") {
        await ctx.db.patch(result.recipientId, {
          status: "sent",
          messageSid: result.messageSid,
          sentAt: Date.now(),
          claimedAt: undefined,
          errorCode: undefined,
          errorMessage: undefined,
        });
        sent += 1;
        continue;
      }

      const canRetry =
        result.outcome === "retry" && recipient.attempts < MAX_ATTEMPTS;

      await ctx.db.patch(result.recipientId, {
        status: canRetry ? "pending" : "failed",
        claimedAt: undefined,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
      });

      if (!canRetry) failed += 1;
    }

    // One counter patch per batch, never per message: this doc is hot.
    await patchCounters(ctx, args.broadcastId, { sent, failed });

    const broadcast = await ctx.db.get(args.broadcastId);
    if (broadcast?.status !== "running") return null;

    await ctx.scheduler.runAfter(
      args.nextDelayMs,
      internal.functions.broadcastSender.runBroadcastBatch,
      { broadcastId: args.broadcastId },
    );
    return null;
  },
});

export const finalizeBroadcast = internalMutation({
  args: { broadcastId: v.id("broadcasts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const broadcast = await ctx.db.get(args.broadcastId);
    if (!broadcast || broadcast.status !== "running") return null;

    // Anything still claimed means a worker died mid-flight; leave it to the watchdog.
    const stillSending = await ctx.db
      .query("broadcastRecipients")
      .withIndex("by_broadcast_status", (q) =>
        q.eq("broadcastId", args.broadcastId).eq("status", "sending"),
      )
      .first();
    if (stillSending) return null;

    await ctx.db.patch(args.broadcastId, {
      status: "completed",
      completedAt: Date.now(),
      lastHeartbeatAt: Date.now(),
    });
    return null;
  },
});

/**
 * Persist a broadcast send into the message history.
 *
 * Deliberately does NOT go through whatsapp.storeOutboundMessage: that path calls
 * createOrGetParticipant, which uses .unique() on the phone index and throws when
 * two participants share a normalized phone — reachable today, because the CSV
 * import dedupes on email before phone. It runs *after* the Twilio POST succeeded,
 * so the throw would mark a delivered message as failed and a retry would send it
 * twice. Here the participant is already known, so there is nothing to resolve.
 */
export const logBroadcastMessage = internalMutation({
  args: {
    participantId: v.id("participants"),
    messageId: v.string(),
    phone: v.string(),
    templateName: v.string(),
    twilioData: v.optional(v.any()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    let conversation = await ctx.db
      .query("conversations")
      .withIndex("by_participant", (q) => q.eq("participantId", args.participantId))
      .first();

    if (!conversation) {
      const conversationId = await ctx.db.insert("conversations", {
        participantId: args.participantId,
        channel: "whatsapp",
        openedAt: Date.now(),
        lastMessageAt: Date.now(),
        isOpen: true,
      });
      conversation = await ctx.db.get(conversationId);
    } else {
      await ctx.db.patch(conversation._id, { lastMessageAt: Date.now() });
    }

    if (!conversation) return null;

    await ctx.db.insert("whatsappMessages", {
      messageId: args.messageId,
      participantId: args.participantId,
      conversationId: conversation._id,
      body: `[Template: ${args.templateName}]`,
      direction: "outbound",
      messageType: "outbound",
      status: "sent",
      stateSnapshot: {
        twilioPayload: {
          MessageSid: args.messageId,
          AccountSid: args.twilioData?.account_sid ?? "",
          From: args.twilioData?.from ?? "",
          To: args.phone,
          Body: `[Template: ${args.templateName}]`,
        },
        processingState: { received: Date.now() },
      },
    });

    return null;
  },
});

// ---------------------------------------------------------------------------
// Watchdog
// ---------------------------------------------------------------------------

export const resumeStalled = internalMutation({
  args: {},
  returns: v.object({ resumed: v.number(), reaped: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    const cutoff = now - STALE_CLAIM_MS;
    let resumed = 0;
    let reaped = 0;

    const running = await ctx.db
      .query("broadcasts")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .collect();

    const enqueueing = await ctx.db
      .query("broadcasts")
      .withIndex("by_status", (q) => q.eq("status", "enqueueing"))
      .collect();

    for (const broadcast of enqueueing) {
      if ((broadcast.lastHeartbeatAt ?? 0) > cutoff) continue;
      await ctx.db.patch(broadcast._id, { lastHeartbeatAt: now });
      await ctx.scheduler.runAfter(0, internal.functions.broadcasts.enqueueRecipients, {
        broadcastId: broadcast._id,
      });
      resumed += 1;
    }

    for (const broadcast of running) {
      if ((broadcast.lastHeartbeatAt ?? 0) > cutoff) continue;

      // Reap stale claims to `failed`, NOT back to `pending`. Twilio's /Messages has
      // no idempotency key, so an automatic requeue is an automatic double-send.
      // Requeueing these is an explicit admin decision (retryFailed).
      const stale = await ctx.db
        .query("broadcastRecipients")
        .withIndex("by_broadcast_status", (q) =>
          q.eq("broadcastId", broadcast._id).eq("status", "sending"),
        )
        .collect();

      let reapedHere = 0;
      for (const recipient of stale) {
        if ((recipient.claimedAt ?? 0) > cutoff) continue;
        await ctx.db.patch(recipient._id, {
          status: "failed",
          errorCode: -1,
          errorMessage: "Estado desconhecido — a mensagem pode ter sido enviada",
          claimedAt: undefined,
        });
        reapedHere += 1;
      }

      if (reapedHere > 0) {
        await patchCounters(ctx, broadcast._id, { failed: reapedHere });
        reaped += reapedHere;
      }

      await ctx.db.patch(broadcast._id, { lastHeartbeatAt: now });
      await ctx.scheduler.runAfter(
        0,
        internal.functions.broadcastSender.runBroadcastBatch,
        { broadcastId: broadcast._id },
      );
      resumed += 1;
    }

    return { resumed, reaped };
  },
});

// ---------------------------------------------------------------------------
// Control
// ---------------------------------------------------------------------------

export const pauseBroadcast = mutation({
  args: { broadcastId: v.id("broadcasts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOrganizer(ctx, "editor");
    const broadcast = await ctx.db.get(args.broadcastId);
    if (!broadcast) throw new Error("Disparo não encontrado");
    if (broadcast.status !== "running") return null;
    await ctx.db.patch(args.broadcastId, { status: "paused" });
    return null;
  },
});

export const resumeBroadcast = mutation({
  args: { broadcastId: v.id("broadcasts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOrganizer(ctx, "editor");
    const broadcast = await ctx.db.get(args.broadcastId);
    if (!broadcast) throw new Error("Disparo não encontrado");
    if (broadcast.status !== "paused") return null;

    await ctx.db.patch(args.broadcastId, {
      status: "running",
      lastHeartbeatAt: Date.now(),
    });
    await ctx.scheduler.runAfter(
      0,
      internal.functions.broadcastSender.runBroadcastBatch,
      { broadcastId: args.broadcastId },
    );
    return null;
  },
});

export const cancelBroadcast = mutation({
  args: { broadcastId: v.id("broadcasts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOrganizer(ctx, "editor");
    const broadcast = await ctx.db.get(args.broadcastId);
    if (!broadcast) throw new Error("Disparo não encontrado");
    if (["completed", "cancelled"].includes(broadcast.status)) return null;

    await ctx.db.patch(args.broadcastId, {
      status: "cancelled",
      completedAt: Date.now(),
    });
    return null;
  },
});

export const retryFailed = mutation({
  args: {
    broadcastId: v.id("broadcasts"),
    errorCode: v.optional(v.number()),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    await requireOrganizer(ctx, "editor");
    const broadcast = await ctx.db.get(args.broadcastId);
    if (!broadcast) throw new Error("Disparo não encontrado");

    const failed = await ctx.db
      .query("broadcastRecipients")
      .withIndex("by_broadcast_status", (q) =>
        q.eq("broadcastId", args.broadcastId).eq("status", "failed"),
      )
      .collect();

    let requeued = 0;
    for (const recipient of failed) {
      if (args.errorCode !== undefined && recipient.errorCode !== args.errorCode) {
        continue;
      }
      await ctx.db.patch(recipient._id, {
        status: "pending",
        attempts: 0,
        errorCode: undefined,
        errorMessage: undefined,
      });
      requeued += 1;
    }

    if (requeued === 0) return 0;

    await ctx.db.patch(args.broadcastId, {
      status: "running",
      failedCount: Math.max(0, broadcast.failedCount - requeued),
      completedAt: undefined,
      lastHeartbeatAt: Date.now(),
    });
    await ctx.scheduler.runAfter(
      0,
      internal.functions.broadcastSender.runBroadcastBatch,
      { broadcastId: args.broadcastId },
    );

    return requeued;
  },
});

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export const getBroadcast = query({
  args: { broadcastId: v.id("broadcasts") },
  handler: async (ctx, args) => {
    await requireOrganizer(ctx, "viewer");
    return ctx.db.get(args.broadcastId);
  },
});

export const listBroadcasts = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireOrganizer(ctx, "viewer");
    return ctx.db
      .query("broadcasts")
      .withIndex("by_created")
      .order("desc")
      .take(args.limit ?? 50);
  },
});

export const listRecipients = query({
  args: {
    broadcastId: v.id("broadcasts"),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("sending"),
        v.literal("sent"),
        v.literal("delivered"),
        v.literal("read"),
        v.literal("failed"),
        v.literal("skipped"),
      ),
    ),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await requireOrganizer(ctx, "viewer");
    const status = args.status;
    if (status) {
      return await ctx.db
        .query("broadcastRecipients")
        .withIndex("by_broadcast_status", (q) =>
          q.eq("broadcastId", args.broadcastId).eq("status", status),
        )
        .paginate(args.paginationOpts);
    }
    return await ctx.db
      .query("broadcastRecipients")
      .withIndex("by_broadcast", (q) => q.eq("broadcastId", args.broadcastId))
      .paginate(args.paginationOpts);
  },
});

/** Failure breakdown grouped by Twilio error code, for the detail page. */
export const getFailureSummary = query({
  args: { broadcastId: v.id("broadcasts") },
  returns: v.array(
    v.object({
      errorCode: v.optional(v.number()),
      errorMessage: v.string(),
      count: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    await requireOrganizer(ctx, "viewer");
    const failed = await ctx.db
      .query("broadcastRecipients")
      .withIndex("by_broadcast_status", (q) =>
        q.eq("broadcastId", args.broadcastId).eq("status", "failed"),
      )
      .take(2000);

    const groups = new Map<string, { errorCode?: number; errorMessage: string; count: number }>();
    for (const recipient of failed) {
      const key = String(recipient.errorCode ?? "unknown");
      const existing = groups.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        groups.set(key, {
          errorCode: recipient.errorCode,
          errorMessage: recipient.errorMessage ?? "Erro desconhecido",
          count: 1,
        });
      }
    }

    return [...groups.values()].sort((a, b) => b.count - a.count);
  },
});

/**
 * Skip breakdown grouped by skipReason, for the detail page. Mirrors
 * getFailureSummary: a skipped number never reached Twilio (deduped, invalid,
 * or outside the test allowlist), so the operator needs to see WHY a number
 * they expected to reach was dropped. Phones are included per reason (capped)
 * so the operator can find a specific number. Counts beyond the scan cap are
 * still reflected in the broadcast's skippedCount total on the page.
 */
export const getSkippedSummary = query({
  args: { broadcastId: v.id("broadcasts") },
  returns: v.array(
    v.object({
      skipReason: v.string(),
      count: v.number(),
      phones: v.array(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    await requireOrganizer(ctx, "viewer");
    const skipped = await ctx.db
      .query("broadcastRecipients")
      .withIndex("by_broadcast_status", (q) =>
        q.eq("broadcastId", args.broadcastId).eq("status", "skipped"),
      )
      .take(5000);

    const groups = new Map<string, { skipReason: string; count: number; phones: string[] }>();
    for (const recipient of skipped) {
      const key = recipient.skipReason ?? "unknown";
      const existing = groups.get(key);
      if (existing) {
        existing.count += 1;
        if (existing.phones.length < 500) existing.phones.push(recipient.phone);
      } else {
        groups.set(key, { skipReason: key, count: 1, phones: [recipient.phone] });
      }
    }

    return [...groups.values()].sort((a, b) => b.count - a.count);
  },
});

/** Used by the status webhook to map a Twilio MessageSid back to a recipient. */
export const updateRecipientByMessageSid = internalMutation({
  args: {
    messageSid: v.string(),
    status: v.string(),
    errorCode: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const recipient = await ctx.db
      .query("broadcastRecipients")
      .withIndex("by_message_sid", (q) => q.eq("messageSid", args.messageSid))
      .first();
    if (!recipient) return null;

    const mapped =
      args.status === "delivered"
        ? "delivered"
        : args.status === "read"
          ? "read"
          : args.status === "failed" || args.status === "undelivered"
            ? "failed"
            : null;

    if (!mapped) return null;
    if (recipient.status === mapped) return null;

    // A delivery failure arrives after we already counted the send as successful.
    if (mapped === "failed" && recipient.status !== "failed") {
      const broadcast = await ctx.db.get(recipient.broadcastId);
      if (broadcast) {
        await ctx.db.patch(recipient.broadcastId, {
          sentCount: Math.max(0, broadcast.sentCount - 1),
          failedCount: broadcast.failedCount + 1,
        });
      }
    }

    await ctx.db.patch(recipient._id, {
      status: mapped,
      errorCode: args.errorCode ?? recipient.errorCode,
      errorMessage:
        mapped === "failed"
          ? (recipient.errorMessage ?? "Falha na entrega")
          : recipient.errorMessage,
    });
    return null;
  },
});

export const getBroadcastInternal = internalQuery({
  args: { broadcastId: v.id("broadcasts") },
  handler: async (ctx, args) => ctx.db.get(args.broadcastId),
});
