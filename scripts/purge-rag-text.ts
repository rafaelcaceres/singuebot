#! /usr/bin/env node
/**
 * Interactive tool to find and delete RAG entries containing a substring.
 *
 * Workflow per iteration:
 *   1. ask for a search string
 *   2. dry-run against admin:findKnowledgeByText
 *   3. show matches grouped by entry
 *   4. ask for confirmation; if yes, run again with dryRun:false
 *   5. loop until empty input
 *
 * Usage:
 *   # Against dev (uses CONVEX_URL from .env.local):
 *   npx tsx scripts/purge-rag-text.ts <namespace>
 *
 *   # Against prod (pass the prod deployment URL explicitly):
 *   npx tsx scripts/purge-rag-text.ts <namespace> --url https://<prod>.convex.cloud
 *
 * Find the namespace value in the bot's `botSettings.config.ragNamespace`.
 */

import { config } from "dotenv";
import { ConvexHttpClient } from "convex/browser";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { api } from "../convex/_generated/api";

config({ path: ".env.local" });

function parseArgs() {
  const args = process.argv.slice(2);
  const positional: string[] = [];
  const flags: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      flags[key] = args[i + 1];
      i++;
    } else {
      positional.push(a);
    }
  }
  return { positional, flags };
}

const { positional, flags } = parseArgs();
const namespace = positional[0];
const url =
  flags.url ||
  process.env.CONVEX_URL ||
  process.env.VITE_CONVEX_URL;

if (!namespace) {
  console.error("Usage: npx tsx scripts/purge-rag-text.ts <namespace> [--url <convex-url>]");
  process.exit(1);
}
if (!url) {
  console.error(
    "❌ No Convex URL. Pass --url <prod-url> or set CONVEX_URL / VITE_CONVEX_URL in .env.local",
  );
  process.exit(1);
}

const isProd = url.includes(".convex.cloud") && !url.includes("dev");
const banner = isProd ? "🚨 PROD" : "🧪 DEV";
console.log(`${banner} • ${url}`);
console.log(`Namespace: ${namespace}\n`);

const client = new ConvexHttpClient(url);
const rl = readline.createInterface({ input, output });

type Match = {
  entryId: string;
  key?: string;
  title?: string;
  chunkOrder: number;
  snippet: string;
};

function groupByEntry(matches: Match[]) {
  const byEntry = new Map<string, Match[]>();
  for (const m of matches) {
    if (!byEntry.has(m.entryId)) byEntry.set(m.entryId, []);
    byEntry.get(m.entryId)!.push(m);
  }
  return byEntry;
}

async function runOnce() {
  const search = (await rl.question("🔍 Texto a procurar (vazio = sair): ")).trim();
  if (!search) return false;

  const res = await client.action(api.admin.findKnowledgeByText, {
    namespace,
    searchText: search,
    dryRun: true,
  });

  if (res.matches.length === 0) {
    console.log("   nada encontrado.\n");
    return true;
  }

  const byEntry = groupByEntry(res.matches as Match[]);
  console.log(`\n   ${res.matches.length} chunk(s) em ${byEntry.size} entry(s):`);
  for (const [entryId, ms] of byEntry) {
    const first = ms[0];
    console.log(`\n   📄 ${first.title ?? "(sem título)"}`);
    console.log(`      key:     ${first.key ?? "<no key — entry pré-fix>"}`);
    console.log(`      entryId: ${entryId}`);
    console.log(`      ${ms.length} chunk(s) com match:`);
    for (const m of ms.slice(0, 5)) {
      console.log(`        #${m.chunkOrder}: ${m.snippet}`);
    }
    if (ms.length > 5) console.log(`        … (+${ms.length - 5} mais)`);
  }

  const confirm = (
    await rl.question(
      `\n⚠️  Apagar ${byEntry.size} entry(s) inteira(s) ${isProd ? "EM PROD" : ""}? digite "yes" pra confirmar: `,
    )
  ).trim();

  if (confirm.toLowerCase() === "yes") {
    const del = await client.action(api.admin.findKnowledgeByText, {
      namespace,
      searchText: search,
      dryRun: false,
    });
    console.log(`✅ ${del.entriesDeleted} entry(s) apagada(s).\n`);
  } else {
    console.log("   cancelado.\n");
  }
  return true;
}

(async () => {
  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const keepGoing = await runOnce();
      if (!keepGoing) break;
    }
  } finally {
    rl.close();
  }
})();
