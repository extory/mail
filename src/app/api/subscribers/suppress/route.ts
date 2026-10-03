import { unsubscribeByEmail } from "@/lib/db";
import { isValidEmail } from "@/lib/validation";

// Protected by the subscriber API authentication and CSRF middleware.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (typeof body?.email !== "string" || !isValidEmail(body.email.trim())) {
    return Response.json({ error: "invalid_email" }, { status: 400 });
  }
  const email = body.email.trim().toLowerCase();
  unsubscribeByEmail(email);
  return Response.json({ success: true, email }, { headers: { "Cache-Control": "no-store" } });
}
