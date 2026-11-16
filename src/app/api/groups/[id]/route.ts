import { deleteGroup, renameGroup } from "@/lib/db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  deleteGroup(Number(id));
  return Response.json({ success: true });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)) ||
      typeof body?.name !== "string" || !body.name.trim() || body.name.trim().length > 200) {
    return Response.json({ error: "invalid_name" }, { status: 400 });
  }
  try {
    const group = renameGroup(Number(id), body.name.trim());
    if (!group) return Response.json({ error: "not_found" }, { status: 404 });
    if (group === "duplicate") return Response.json({ error: "duplicate_name" }, { status: 409 });
    return Response.json(group);
  } catch {
    return Response.json({ error: "rename_failed" }, { status: 500 });
  }
}
