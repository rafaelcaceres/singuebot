import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const createAdminUser = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if organizer already exists
    const existingOrganizer = await ctx.db
      .query("organizers")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .first();

    if (!existingOrganizer) {
      // Create organizer first
      await ctx.db.insert("organizers", {
        email: args.email,
        role: "owner",
      });
      console.log(`Created organizer with email: ${args.email}`);
    } else {
      console.log(`Organizer with email ${args.email} already exists with role: ${existingOrganizer.role}`);
    }

    return { success: true, message: `Admin user setup completed for ${args.email}` };
  },
});