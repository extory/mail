import { removeSubscriber } from "@/lib/db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  removeSubscriber(Number(id));
  return Response.json({ success: true });
}
