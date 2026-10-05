"use node";

import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import {
  postTemplateMessage,
  statusCallbackUrl,
  TwilioSendError,
} from "../lib/twilioClient";

/**
 * The sending half of the broadcast engine.
 *
 * One invocation = one batch. It claims, sends with a gap between messages, records
 * the results, and the recording mutation schedules the next invocation. Keeping the
 * chain in the mutation makes the continuation transactional: results and next tick
 * commit together, so a crash between them cannot lose the chain.
 */

const RATE_LIMIT_BACKOFF_MS = 30_000;

interface BatchResult {
  recipientId: any;
  outcome: "sent" | "failed" | "retry";
  messageSid?: string;
  errorCode?: number;
  errorMessage?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const runBroadcastBatch = internalAction({
  args: { broadcastId: v.id("broadcasts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const claim = await ctx.runMutation(
      internal.functions.broadcasts.claimNextBatch,
      { broadcastId: args.broadcastId },
    );

    // Paused or cancelled: the chain simply ends. No cross-process signalling needed.
    if (claim.stop) return null;

    if (claim.exhausted) {
      await ctx.runMutation(internal.functions.broadcasts.finalizeBroadcast, {
        broadcastId: args.broadcastId,
      });
      return null;
    }

    const callback = statusCallbackUrl();
    const results: BatchResult[] = [];
    let sawRateLimit = false;

    for (const item of claim.items) {
      try {
        if (claim.dryRun) {
          // Exercises the entire pipeline except the network call.
          results.push({
            recipientId: item.recipientId,
            outcome: "sent",
            messageSid: `DRYRUN_${item.recipientId}`,
          });
        } else {
          const response = await postTemplateMessage({
            to: item.phone,
            contentSid: claim.contentSid,
            contentVariables: item.contentVariables,
            statusCallback: callback,
          });

          results.push({
            recipientId: item.recipientId,
            outcome: "sent",
            messageSid: response.sid,
          });

          await ctx.runMutation(internal.functions.broadcasts.logBroadcastMessage, {
            participantId: item.participantId,
            recipientId: item.recipientId,
            messageId: response.sid,
            phone: item.phone,
            templateName: claim.templateName,
            twilioData: response,
          });
        }
      } catch (error) {
        if (error instanceof TwilioSendError) {
          if (error.retryable) sawRateLimit = true;
          results.push({
            recipientId: item.recipientId,
            outcome: error.retryable ? "retry" : "failed",
            errorCode: error.code,
            errorMessage: error.message,
          });
        } else {
          results.push({
            recipientId: item.recipientId,
            outcome: "retry",
            errorMessage:
              error instanceof Error ? error.message : "Erro desconhecido no envio",
          });
        }
      }

      if (claim.gapMs > 0) await sleep(claim.gapMs);
    }

    await ctx.runMutation(internal.functions.broadcasts.recordBatchResults, {
      broadcastId: args.broadcastId,
      results,
      nextDelayMs: sawRateLimit ? RATE_LIMIT_BACKOFF_MS : 0,
    });

    return null;
  },
});
