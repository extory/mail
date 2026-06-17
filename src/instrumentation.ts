// Next.js instrumentation hook — runs once per server start.
// We use it to boot the scheduled-send poller so reservations are
// processed without needing an external cron.

export async function register() {
  // Only run on the Node.js runtime (not edge).
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startScheduler } = await import("./lib/scheduler");
  startScheduler();
}
