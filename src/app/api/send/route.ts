import { NextRequest } from "next/server";
import { getSubscribers, addSendLog } from "@/lib/db";
import { sendBulkEmails } from "@/lib/resend";

export async function POST(request: NextRequest) {
  const { subject, htmlContent, prompt, groupId } = await request.json();

  if (!subject || !htmlContent) {
    return Response.json(
      { error: "Subject and htmlContent are required" },
      { status: 400 }
    );
  }

  const subscribers = groupId
    ? getSubscribers(undefined, groupId)
    : getSubscribers();

  if (subscribers.length === 0) {
    return Response.json({ error: "No active subscribers" }, { status: 400 });
  }

  const recipients = subscribers.map((s) => ({
    email: s.email,
    name: s.name,
  }));

  // Create send log first to get the ID
  const sendLog = addSendLog(subject, htmlContent, recipients.length, "sending", prompt);

  const result = await sendBulkEmails(subject, htmlContent, recipients, sendLog.id);

  // Update send log status
  const status =
    result.failed === 0
      ? "sent"
      : result.success === 0
        ? "failed"
        : "partial";

  // Update the status in DB
  const Database = await import("better-sqlite3");
  const path = await import("path");
  const db = new Database.default(path.join(process.cwd(), "data", "mail.db"));
  db.prepare("UPDATE send_log SET status = ?, recipient_count = ? WHERE id = ?")
    .run(status, result.success, sendLog.id);
  db.close();

  return Response.json({
    success: result.success,
    failed: result.failed,
    total: recipients.length,
    status,
    error: result.error,
  });
}
