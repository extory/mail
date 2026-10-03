import { isValidEmail } from "@/lib/validation";
import { removeSubscriber, updateSubscriberDetails } from "@/lib/db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  removeSubscriber(Number(id));
  return Response.json({ success: true });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)) ||
      typeof body?.email !== "string" || !isValidEmail(body.email.trim()) ||
      typeof body?.name !== "string" || body.name.trim().length > 200) {
    return Response.json({ error: "Invalid subscriber details." }, { status: 400 });
  }
  const subscriber = updateSubscriberDetails(Number(id), body.email.trim(), body.name.trim());
  if (!subscriber) return Response.json({ error: "Subscriber not found." }, { status: 404 });
  if (subscriber === "unsubscribed") return Response.json({ error: "email_unsubscribed" }, { status: 409 });
  if (subscriber === "duplicate") return Response.json({ error: "Email already registered." }, { status: 409 });
  return Response.json(subscriber);
}
