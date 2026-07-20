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

/**
 * Broadcast watchdog.
 *
 * The send chain is self-scheduling, so under normal operation this finds nothing.
 * It exists for the cases the chain cannot recover from on its own: a deploy landing
 * mid-broadcast, an action crashing before it recorded its batch, or a Twilio outage
 * long enough to exhaust retries. It re-kicks any running/enqueueing broadcast whose
 * heartbeat has gone stale, and reaps claims stuck in "sending".
 */
crons.interval(
  "resume stalled broadcasts",
  { minutes: 5 },
  internal.functions.broadcasts.resumeStalled,
  {},
);

export default crons;
