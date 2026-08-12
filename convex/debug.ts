import { internalQuery } from "./_generated/server";

// Dev-only inspection tools — internal so they aren't a public data leak.
// Run via `npx convex run debug:<name>` or the Convex dashboard.

export const listUsers = internalQuery({
  handler: async (ctx) => {
    const users = await ctx.db
      .query("users")
      .collect();

    console.log("Current users:", users);
    return users;
  },
});

export const listOrganizers = internalQuery({
  handler: async (ctx) => {
    const organizers = await ctx.db
      .query("organizers")
      .collect();

    console.log("Current organizers:", organizers);
    return organizers;
  },
});
