import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Optional: Auto-reindex participants every day at 3 AM
// Uncomment to enable automatic daily reindexing
/*
crons.daily(
  "reindex participants",
  { hourUTC: 3, minuteUTC: 0 }, // 3 AM UTC
  internal.functions.participantRAG.batchAddParticipants,
  { limit: 1000 }
);
*/

// Optional: Sync new participants every hour
// Uncomment to enable hourly incremental indexing
/*
crons.hourly(
  "sync new participants",
  { minuteUTC: 0 },
  internal.functions.participantRAG.batchAddParticipants,
  { limit: 100, skipExisting: true }
);
*/

export default crons;
