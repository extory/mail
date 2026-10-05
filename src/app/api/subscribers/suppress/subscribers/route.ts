import { deleteSuppressedSubscribers } from "@/lib/db";
import { isValidEmail } from "@/lib/validation";

// Authentication and CSRF checks apply through the subscriber API middleware.
export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null);
  if (!Array.isArray(body?.emails) || body.emails.length === 0 || body.emails.length > 1000 ||
      body.emails.some((email: unknown) => typeof email !== "string" || !isValidEmail(email.trim()))) {
    return Response.json({ error: "invalid_emails" }, { status: 400 });
  }
  const emails = [...new Set<string>(body.emails.map((email: string) => email.trim().toLowerCase()))];
  try {
    const removed = deleteSuppressedSubscribers(emails);
    return Response.json({ removed });
  } catch (error) {
    if (error instanceof Error && error.message === "not_suppressed") {
      return Response.json({ error: "not_suppressed" }, { status: 400 });
    }
    return Response.json({ error: "delete_failed" }, { status: 500 });
  }
}
