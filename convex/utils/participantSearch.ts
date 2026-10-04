import { v } from "convex/values";
import { internalQuery } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { getPhoneVariations, normalizePhoneNumber } from "./phoneNormalizer";
import schema from "../schema";

/**
 * Full participant document validator, derived from the schema.
 *
 * These used to be hand-written with a subset of the table's fields, so any
 * participant carrying a field outside that subset (e.g. `importSource` on
 * CSV-imported participants) failed with ReturnsValidationError.
 */
export const participantDocValidator = v.object({
  _id: v.id("participants"),
  _creationTime: v.number(),
  ...schema.tables.participants.validator.fields,
});

/**
 * Find participant by phone number, considering equivalent variations
 * @param ctx - Convex context
 * @param phone - Phone number to search for
 * @returns Participant document or null if not found
 */
export const findParticipantByPhone = internalQuery({
  args: {
    phone: v.string(),
  },
  returns: v.union(participantDocValidator, v.null()),
  handler: async (ctx, args) => {
    // Get all possible variations of the phone number
    const phoneVariations = getPhoneVariations(args.phone);
    
    // Try to find participant with any of the variations
    for (const variation of phoneVariations) {
      const participant = await ctx.db
        .query("participants")
        .withIndex("by_phone", (q) => q.eq("phone", variation))
        .unique();
      
      if (participant) {
        return participant;
      }
    }
    
    return null;
  },
});

/**
 * Find WhatsApp contact by phone number, considering equivalent variations
 * @param ctx - Convex context
 * @param phone - Phone number to search for
 * @returns WhatsApp contact document or null if not found
 */
export const findWhatsAppContactByPhone = internalQuery({
  args: {
    phone: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("whatsappContacts"),
      _creationTime: v.number(),
      phoneNumber: v.string(),
      name: v.optional(v.string()),
      lastMessageTime: v.optional(v.number()),
      isActive: v.boolean(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    // Get all possible variations of the phone number
    const phoneVariations = getPhoneVariations(args.phone);
    
    // Try to find contact with any of the variations
    for (const variation of phoneVariations) {
      const contact = await ctx.db
        .query("whatsappContacts")
        .withIndex("by_phone", (q) => q.eq("phoneNumber", variation))
        .unique();
      
      if (contact) {
        return contact;
      }
    }
    
    return null;
  },
});

/**
 * Find all participants that match any variation of the given phone number
 * Useful for data migration or cleanup operations
 * @param ctx - Convex context
 * @param phone - Phone number to search for
 * @returns Array of participant documents
 */
export const findAllParticipantVariations = internalQuery({
  args: {
    phone: v.string(),
  },
  returns: v.array(participantDocValidator),
  handler: async (ctx, args) => {
    const phoneVariations = getPhoneVariations(args.phone);
    const participants = [];
    
    // Find all participants with any of the variations
    for (const variation of phoneVariations) {
      const participant = await ctx.db
        .query("participants")
        .withIndex("by_phone", (q) => q.eq("phone", variation))
        .unique();
      
      if (participant) {
        participants.push(participant);
      }
    }
    
    return participants;
  },
});

/**
 * Find all WhatsApp contacts that match any variation of the given phone number
 * Useful for data migration or cleanup operations
 * @param ctx - Convex context
 * @param phone - Phone number to search for
 * @returns Array of WhatsApp contact documents
 */
export const findAllContactVariations = internalQuery({
  args: {
    phone: v.string(),
  },
  returns: v.array(v.object({
    _id: v.id("whatsappContacts"),
    _creationTime: v.number(),
    phoneNumber: v.string(),
    name: v.optional(v.string()),
    lastMessageTime: v.optional(v.number()),
    isActive: v.boolean(),
  })),
  handler: async (ctx, args) => {
    const phoneVariations = getPhoneVariations(args.phone);
    const contacts = [];
    
    // Find all contacts with any of the variations
    for (const variation of phoneVariations) {
      const contact = await ctx.db
        .query("whatsappContacts")
        .withIndex("by_phone", (q) => q.eq("phoneNumber", variation))
        .unique();
      
      if (contact) {
        contacts.push(contact);
      }
    }
    
    return contacts;
  },
});