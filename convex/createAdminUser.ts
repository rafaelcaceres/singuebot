import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Bootstrap tool only — run via `npx convex run createAdminUser:createAdminUser
 * '{"email":"...","password":"..."}'`. Deliberately internal: this grants
 * owner access, so it must never be reachable from the public client.
 */
export const createAdminUser = internalMutation({
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
