import { deleteGroup } from "@/lib/db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  deleteGroup(Number(id));
  return Response.json({ success: true });
}
