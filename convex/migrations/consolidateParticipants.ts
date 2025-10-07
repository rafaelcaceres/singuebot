import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import type { Id, Doc } from "../_generated/dataModel";
import { normalizePhoneNumber } from "../utils/phoneNormalizer";

/**
 * Consolidate all duplicate participants by merging data and updating references
 */
export const consolidateAllDuplicates = internalMutation({
  args: {},
  returns: v.object({
    success: v.boolean(),
    totalProcessed: v.number(),
    totalMerged: v.number(),
    errors: v.array(v.string()),
  }),
  handler: async (ctx) => {
    try {
      // Get all participants
      const allParticipants = await ctx.db.query("participants").collect();
      
      // Group by normalized phone number
      const phoneGroups = new Map<string, Array<Doc<"participants">>>();
      
      for (const participant of allParticipants) {
        const normalizedPhone = normalizePhoneNumber(participant.phone);
        
        if (!phoneGroups.has(normalizedPhone)) {
          phoneGroups.set(normalizedPhone, []);
        }
        phoneGroups.get(normalizedPhone)!.push(participant);
      }
      
      // Find groups with duplicates
      const duplicateGroups = Array.from(phoneGroups.entries()).filter(([_, participants]) => participants.length > 1);
      
      let totalMerged = 0;
      const errors: string[] = [];
      
      // Process each group of duplicates
      for (const [normalizedPhone, participants] of duplicateGroups) {
        try {
          // Sort by creation time to keep the oldest as primary
          const sortedParticipants = participants.sort((a, b) => a._creationTime - b._creationTime);
          const primaryParticipant = sortedParticipants[0];
          const duplicatesToMerge = sortedParticipants.slice(1);
          
          // Merge data from duplicates into primary participant
          const mergedData: Partial<Doc<"participants">> = {
            phone: normalizedPhone, // Ensure normalized
          };
          
          // Merge non-empty fields from duplicates
          for (const duplicate of duplicatesToMerge) {
            if (!mergedData.name && duplicate.name) {
              mergedData.name = duplicate.name;
            }
            if (!mergedData.cargo && duplicate.cargo) {
              mergedData.cargo = duplicate.cargo;
            }
            if (!mergedData.empresa && duplicate.empresa) {
              mergedData.empresa = duplicate.empresa;
            }
            if (!mergedData.setor && duplicate.setor) {
              mergedData.setor = duplicate.setor;
            }
            if (!mergedData.clusterId && duplicate.clusterId) {
              mergedData.clusterId = duplicate.clusterId;
            }
            if (!mergedData.threadId && duplicate.threadId) {
              mergedData.threadId = duplicate.threadId;
            }
            
            // Merge tags (remove duplicates)
            const existingTags = new Set(mergedData.tags || primaryParticipant.tags);
            for (const tag of duplicate.tags) {
              existingTags.add(tag);
            }
            mergedData.tags = Array.from(existingTags);
            
            // Keep consent if any duplicate has given consent
            if (duplicate.consent && !primaryParticipant.consent) {
              mergedData.consent = true;
            }
          }
          
          // Update primary participant with merged data
          await ctx.db.patch(primaryParticipant._id, mergedData);
          
          // Update all messages to reference the primary participant
          for (const duplicate of duplicatesToMerge) {
            const messages = await ctx.db
              .query("whatsappMessages")
              .withIndex("by_participant", (q) => q.eq("participantId", duplicate._id))
              .collect();
            
            for (const message of messages) {
              await ctx.db.patch(message._id, {
                participantId: primaryParticipant._id,
              });
            }
            
            // Update conversations
            const conversations = await ctx.db
              .query("conversations")
              .withIndex("by_participant", (q) => q.eq("participantId", duplicate._id))
              .collect();
            
            for (const conversation of conversations) {
              await ctx.db.patch(conversation._id, {
                participantId: primaryParticipant._id,
              });
            }
            
            // Update interview sessions
            const interviewSessions = await ctx.db
              .query("interview_sessions")
              .withIndex("by_participant", (q) => q.eq("participantId", duplicate._id))
              .collect();
            
            for (const session of interviewSessions) {
              await ctx.db.patch(session._id, {
                participantId: primaryParticipant._id,
              });
            }
            
            // Delete duplicate participant
            await ctx.db.delete(duplicate._id);
          }
          
          totalMerged += duplicatesToMerge.length;
          
        } catch (error) {
          errors.push(`Error processing ${normalizedPhone}: ${String(error)}`);
        }
      }
      
      return {
        success: errors.length === 0,
        totalProcessed: duplicateGroups.length,
        totalMerged,
        errors,
      };
      
    } catch (error) {
      return {
        success: false,
        totalProcessed: 0,
        totalMerged: 0,
        errors: [`Global error: ${String(error)}`],
      };
    }
  },
});