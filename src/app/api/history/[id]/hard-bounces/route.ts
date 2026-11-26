import { deleteHardBouncedSubscribers } from "@/lib/send-tracking";
import { isValidEmail } from "@/lib/validation";

export async function DELETE(request: Request, { params }: {params: Promise<{id: string}>}) {
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) return Response.json({error: "Invalid ID"}, {status: 400});
  const body = await request.json().catch(() => null);
  if (body?.confirmed !== true || !Array.isArray(body.emails) || !body.emails.length || body.emails.length > 1000 ||
    body.emails.some((email: unknown) => typeof email !== "string" || !isValidEmail(email.trim()))) {
    return Response.json({error: "Invalid selection or missing confirmation"}, {status: 400});
  }
  try {
    return Response.json({deleted: deleteHardBouncedSubscribers(Number(id), body.emails)});
  } catch (error) {
    if (error instanceof Error && error.message === "not_found") return Response.json({error: "Not found"}, {status: 404});
    if (error instanceof Error && error.message === "not_hard_bounced") return Response.json({error: "Only confirmed hard-bounce recipients can be deleted"}, {status: 400});
    return Response.json({error: "Could not delete subscribers"}, {status: 500});
  }
}
