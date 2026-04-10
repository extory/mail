import { getDraft, deleteDraft } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const draft = getDraft(Number(id));
  if (!draft) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(draft);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  deleteDraft(Number(id));
  return Response.json({ success: true });
}
