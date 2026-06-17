import {
  getDueScheduledSends,
  markScheduledSendRunning,
  markScheduledSendDone,
  getSubscribers,
  addSendLog,
} from "./db";
import { sendBulkEmails } from "./resend";
import Database from "better-sqlite3";
import path from "path";

let timer: NodeJS.Timeout | null = null;
let running = false;

async function runOnce(): Promise<{ processed: number; details: Array<Record<string, unknown>> }> {
  if (running) return { processed: 0, details: [{ skipped: "already running" }] };
  running = true;
  const details: Array<Record<string, unknown>> = [];
  try {
    const now = new Date().toISOString();
    const due = getDueScheduledSends(now);
    for (const job of due) {
      // Atomic claim — skip if another tick already grabbed it
      if (!markScheduledSendRunning(job.id)) continue;

      try {
        const subscribers = job.group_id
          ? getSubscribers(undefined, job.group_id)
          : getSubscribers();
        if (subscribers.length === 0) {
          markScheduledSendDone(job.id, 0, "failed", "No active subscribers");
          details.push({ id: job.id, status: "failed", error: "no subscribers" });
          continue;
        }
        const recipients = subscribers.map((s) => ({ email: s.email, name: s.name }));
        const sendLog = addSendLog(
          job.subject,
          job.html_content,
          recipients.length,
          "sending",
          job.prompt || undefined
        );
        const result = await sendBulkEmails(
          job.subject,
          job.html_content,
          recipients,
          sendLog.id,
          { embedImages: job.embed_images === 1 }
        );
        const status =
          result.failed === 0
            ? "sent"
            : result.success === 0
              ? "failed"
              : "partial";

        // Update send_log status separately (mirrors /api/send)
        const dbPath = path.join(process.cwd(), "data", "mail.db");
        const db = new Database(dbPath);
        try {
          db.prepare("UPDATE send_log SET status = ?, recipient_count = ? WHERE id = ?")
            .run(status, result.success, sendLog.id);
        } finally {
          db.close();
        }

        markScheduledSendDone(
          job.id,
          sendLog.id,
          result.success > 0 ? "sent" : "failed",
          result.error || null
        );
        details.push({ id: job.id, sendLogId: sendLog.id, status, success: result.success, failed: result.failed });
        console.log(
          `[scheduler] job=${job.id} subject="${job.subject}" success=${result.success} failed=${result.failed} status=${status}`
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[scheduler] job=${job.id} threw:`, msg);
        markScheduledSendDone(job.id, 0, "failed", msg);
        details.push({ id: job.id, status: "failed", error: msg });
      }
    }
    return { processed: due.length, details };
  } finally {
    running = false;
  }
}

export async function tickScheduler() {
  return runOnce();
}

/** Start a long-running interval that polls for due scheduled sends.
 *  Safe to call multiple times (no-op on subsequent calls). */
export function startScheduler() {
  if (timer) return;
  // Poll every 30 seconds — fine-grained enough that minute-precision
  // scheduling feels accurate (max ~30s drift).
  timer = setInterval(() => {
    runOnce().catch((err) => console.error("[scheduler] runOnce error", err));
  }, 30 * 1000);
  // Fire once on startup so a server restart immediately catches up.
  runOnce().catch((err) => console.error("[scheduler] initial run error", err));
  console.log("[scheduler] started — polling every 30s");
}
