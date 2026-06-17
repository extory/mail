import { NextRequest } from "next/server";
import { cancelScheduledSend, getScheduledSend } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const send = getScheduledSend(Number(id));
  if (!send) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(send);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ok = cancelScheduledSend(Number(id));
  if (!ok) {
    return Response.json(
      { error: "Cannot cancel — already sent or not pending" },
      { status: 400 }
    );
  }
  return Response.json({ ok: true });
}
