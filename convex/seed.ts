import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const seedAdminUser = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if organizer already exists
    const existing = await ctx.db
      .query("organizers")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (existing) {
      console.log(`Organizer with email ${args.email} already exists with role: ${existing.role}`);
      return existing._id;
    }

    // Create new admin organizer
    const organizerId = await ctx.db.insert("organizers", {
      email: args.email,
      role: "owner",
    });

    console.log(`Created admin organizer with email: ${args.email}`);
    return organizerId;
  },
});

export const listOrganizers = mutation({
  args: {},
  handler: async (ctx) => {
    const organizers = await ctx.db
      .query("organizers")
      .collect();
    
    console.log("Current organizers:", organizers);
    return organizers;
  },
});