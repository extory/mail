import { removeGroupMembers } from "@/lib/db";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const ids = body?.ids;
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)) ||
      !Array.isArray(ids) || ids.length === 0 ||
      !ids.every(value => Number.isSafeInteger(value) && value > 0)) {
    return Response.json({ error: "Invalid group or subscriber IDs." }, { status: 400 });
  }
  const removed = removeGroupMembers(Number(id), ids);
  return removed === null
    ? Response.json({ error: "Group not found." }, { status: 404 })
    : Response.json({ removed });
}
