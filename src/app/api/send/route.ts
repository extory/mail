import { NextRequest } from "next/server";
import { getSubscribers, addSendLog } from "@/lib/db";
import { sendBulkEmails } from "@/lib/resend";

export async function POST(request: NextRequest) {
  const { subject, htmlContent, prompt } = await request.json();

  if (!subject || !htmlContent) {
    return Response.json(
      { error: "Subject and htmlContent are required" },
      { status: 400 }
    );
  }

  const subscribers = getSubscribers();
  if (subscribers.length === 0) {
    return Response.json({ error: "No active subscribers" }, { status: 400 });
  }

  const recipients = subscribers.map((s) => ({
    email: s.email,
    name: s.name,
  }));

  const result = await sendBulkEmails(subject, htmlContent, recipients);

  const status =
    result.failed === 0
      ? "sent"
      : result.success === 0
        ? "failed"
        : "partial";

  addSendLog(subject, htmlContent, result.success, status, prompt);

  return Response.json({
    success: result.success,
    failed: result.failed,
    total: recipients.length,
    status,
  });
}
