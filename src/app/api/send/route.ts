import { NextRequest } from "next/server";
import { getSubscribers, addSendLog, createScheduledSend } from "@/lib/db";
import { sendBulkEmails } from "@/lib/resend";
import { getSession } from "@/lib/auth";

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

  return Response.json(result);
}
