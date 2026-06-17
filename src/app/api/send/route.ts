import { NextRequest } from "next/server";
import { getSubscribers, addSendLog, saveSentEmail, createScheduledSend } from "@/lib/db";
import { sendBulkEmails } from "@/lib/resend";
import { getSession } from "@/lib/auth";
import Database from "better-sqlite3";
import path from "path";
import { randomBytes } from "crypto";

export async function POST(request: NextRequest) {
  const { subject, htmlContent, prompt, groupId, embedImages, scheduledAt } = await request.json();

  if (!subject || !htmlContent) {
    console.error("[send] Missing subject or htmlContent", { subjectLen: subject?.length, htmlLen: htmlContent?.length });
    return Response.json(
      { error: "Subject and htmlContent are required" },
      { status: 400 }
    );
  }

  // Branch: scheduled send — store and return immediately.
  if (scheduledAt) {
    const when = new Date(scheduledAt);
    if (isNaN(when.getTime())) {
      return Response.json({ error: "Invalid scheduledAt" }, { status: 400 });
    }
    if (when.getTime() <= Date.now()) {
      return Response.json(
        { error: "Scheduled time must be in the future" },
        { status: 400 }
      );
    }
    const session = await getSession();
    const job = createScheduledSend(
      subject,
      htmlContent,
      prompt ?? null,
      groupId ?? null,
      embedImages === true,
      when.toISOString(),
      session?.id ?? null
    );
    console.log(
      `[send] scheduled job=${job.id} at=${job.scheduled_at} subject="${subject}"`
    );
    return Response.json({ scheduled: true, id: job.id, scheduledAt: job.scheduled_at });
  }

  const subscribers = groupId
    ? getSubscribers(undefined, groupId)
    : getSubscribers();

  console.log(`[send] subject="${subject}" groupId=${groupId ?? "all"} recipients=${subscribers.length} embedImages=${embedImages === true}`);

  if (subscribers.length === 0) {
    return Response.json({ error: "No active subscribers" }, { status: 400 });
  }

  const recipients = subscribers.map((s) => ({
    email: s.email,
    name: s.name,
  }));

  // Create send log first to get the ID
  const sendLog = addSendLog(subject, htmlContent, recipients.length, "sending", prompt);

  const result = await sendBulkEmails(subject, htmlContent, recipients, sendLog.id, {
    embedImages: embedImages === true,
  });

  console.log(`[send] sendLog=${sendLog.id} success=${result.success} failed=${result.failed} error=${result.error ?? "none"}`);

  // Update send log status + recipient_count
  const status =
    result.failed === 0
      ? "sent"
      : result.success === 0
        ? "failed"
        : "partial";

  const dbPath = path.join(process.cwd(), "data", "mail.db");
  const db = new Database(dbPath);
  try {
    db.prepare("UPDATE send_log SET status = ?, recipient_count = ? WHERE id = ?")
      .run(status, result.success, sendLog.id);

    // Stats safety net: if sendBulkEmails reported successes but no rows
    // were written to sent_emails (Resend response shape we don't recognise,
    // or batch returned without ids), seed placeholder rows so the
    // statistics page at least shows how many emails went out. Placeholder
    // ids start with "local-" so they're easy to identify and won't collide
    // with real Resend ids.
    const row = db.prepare(
      "SELECT COUNT(*) as c FROM sent_emails WHERE send_log_id = ?"
    ).get(sendLog.id) as { c: number };
    const stored = row?.c ?? 0;
    if (stored < result.success) {
      const missing = result.success - stored;
      console.warn(
        `[send] sendLog=${sendLog.id}: only ${stored}/${result.success} email IDs stored. Seeding ${missing} placeholders.`
      );
      // Find which recipients are missing (those not in sent_emails for this send_log)
      const storedEmails = new Set(
        (db
          .prepare("SELECT recipient_email FROM sent_emails WHERE send_log_id = ?")
          .all(sendLog.id) as { recipient_email: string }[]).map((r) => r.recipient_email)
      );
      let seeded = 0;
      for (const r of recipients) {
        if (seeded >= missing) break;
        if (storedEmails.has(r.email)) continue;
        const placeholderId = `local-${sendLog.id}-${randomBytes(8).toString("hex")}`;
        saveSentEmail(sendLog.id, placeholderId, r.email);
        seeded++;
      }
    }
  } finally {
    db.close();
  }

  return Response.json({
    success: result.success,
    failed: result.failed,
    total: recipients.length,
    status,
    error: result.error,
  });
}
