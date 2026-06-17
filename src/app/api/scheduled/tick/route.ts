import { tickScheduler } from "@/lib/scheduler";

// Manual / cron-trigger endpoint that runs one scheduler tick.
// Safe to call from an external cron (e.g. `* * * * * curl …`) if the
// in-process poller ever needs to be supplemented.
export async function POST() {
  const result = await tickScheduler();
  return Response.json(result);
}
