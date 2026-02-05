#! /usr/bin/env node
/**
 * Script to index participants in RAG system
 *
 * Usage:
 *   npm run index-participants          # Index all participants
 *   npm run index-participants 100      # Index first 100 participants
 */

import { config } from "dotenv";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

// Load environment variables from .env.local
config({ path: ".env.local" });

const DEPLOYMENT_URL = process.env.CONVEX_URL || process.env.VITE_CONVEX_URL;

console.log(DEPLOYMENT_URL);

if (!DEPLOYMENT_URL) {
  console.error("❌ Error: CONVEX_URL not found in environment variables");
  console.error("Make sure you have a .env.local file with CONVEX_URL set");
  process.exit(1);
}

// TypeScript assertion since we've already checked for undefined above
const convexUrl: string = DEPLOYMENT_URL;

const limit = process.argv[2] ? parseInt(process.argv[2]) : undefined;

async function main() {
  console.log(`🔗 Connecting to Convex: ${convexUrl}`);

  const client = new ConvexHttpClient(convexUrl);

  console.log(`🚀 Indexing ${limit || 'all'} participants...`);

  try {
    const result = await client.mutation(api.admin.indexAllParticipants, {
      limit,
    });

    console.log("✅", result.message);
    console.log("📊", result.instructions);
    console.log("🔗", result.dashboardUrl);
    console.log("\n💡 Tip: Watch the logs in the Convex Dashboard to see progress");
  } catch (error) {
    console.error("❌ Error indexing participants:", error);
    process.exit(1);
  }
}

void main();
