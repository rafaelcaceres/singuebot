import { v } from "convex/values";
import { query, mutation } from "../_generated/server";

/**
 * Get participants by company
 */
export const getParticipantsByEmpresa = query({
  args: {
    empresa: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("participants")
      .withIndex("by_empresa", (q) => q.eq("empresa", args.empresa))
      .collect();
  },
});

/**
 * Get participants by sector
 */
export const getParticipantsBySetor = query({
  args: {
    setor: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("participants")
      .withIndex("by_setor", (q) => q.eq("setor", args.setor))
      .collect();
  },
});

/**
 * Get participants by position
 */
export const getParticipantsByCargo = query({
  args: {
    cargo: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("participants")
      .withIndex("by_cargo", (q) => q.eq("cargo", args.cargo))
      .collect();
  },
});

/**
 * Get participants by company and sector
 */
export const getParticipantsByEmpresaSetor = query({
  args: {
    empresa: v.string(),
    setor: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("participants")
      .withIndex("by_empresa_setor", (q) => 
        q.eq("empresa", args.empresa).eq("setor", args.setor)
      )
      .collect();
  },
});

/**
 * Get unique companies
 */
export const getUniqueEmpresas = query({
  args: {},
  handler: async (ctx) => {
    const participants = await ctx.db.query("participants").collect();
    const empresas = new Set(
      participants
        .map(p => p.empresa)
        .filter(empresa => empresa !== undefined && empresa !== null && empresa.trim() !== "")
    );
    return Array.from(empresas).sort();
  },
});

/**
 * Get unique sectors
 */
export const getUniqueSetores = query({
  args: {},
  handler: async (ctx) => {
    const participants = await ctx.db.query("participants").collect();
    const setores = new Set(
      participants
        .map(p => p.setor)
        .filter(setor => setor !== undefined && setor !== null && setor.trim() !== "")
    );
    return Array.from(setores).sort();
  },
});

/**
 * Get unique positions
 */
export const getUniqueCargos = query({
  args: {},
  handler: async (ctx) => {
    const participants = await ctx.db.query("participants").collect();
    const cargos = new Set(
      participants
        .map(p => p.cargo)
        .filter(cargo => cargo !== undefined && cargo !== null && cargo.trim() !== "")
    );
    return Array.from(cargos).sort();
  },
});

/**
 * Update participant professional information
 */
export const updateParticipantProfessionalInfo = mutation({
  args: {
    participantId: v.id("participants"),
    cargo: v.optional(v.string()),
    empresa: v.optional(v.string()),
    setor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { participantId, ...updates } = args;
    
    // Filter out undefined values
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, value]) => value !== undefined)
    );
    
    if (Object.keys(filteredUpdates).length > 0) {
      await ctx.db.patch(participantId, filteredUpdates);
    }
    
    return await ctx.db.get(participantId);
  },
});

/**
 * Search participants by professional criteria
 */
export const searchParticipants = query({
  args: {
    cargo: v.optional(v.string()),
    empresa: v.optional(v.string()),
    setor: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let participants = await ctx.db.query("participants").collect();
    
    // Apply filters
    if (args.cargo) {
      participants = participants.filter(p => 
        p.cargo?.toLowerCase().includes(args.cargo!.toLowerCase())
      );
    }
    
    if (args.empresa) {
      participants = participants.filter(p => 
        p.empresa?.toLowerCase().includes(args.empresa!.toLowerCase())
      );
    }
    
    if (args.setor) {
      participants = participants.filter(p => 
        p.setor?.toLowerCase().includes(args.setor!.toLowerCase())
      );
    }
    
    if (args.name) {
      participants = participants.filter(p => 
        p.name?.toLowerCase().includes(args.name!.toLowerCase())
      );
    }
    
    return participants;
  },
});