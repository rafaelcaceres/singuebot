import { query } from "./_generated/server";

export const listUsers = query({
  handler: async (ctx) => {
    const users = await ctx.db
      .query("users")
      .collect();
    
    console.log("Current users:", users);
    return users;
  },
});

export const listOrganizers = query({
  handler: async (ctx) => {
    const organizers = await ctx.db
      .query("organizers")
      .collect();
    
    console.log("Current organizers:", organizers);
    return organizers;
  },
});