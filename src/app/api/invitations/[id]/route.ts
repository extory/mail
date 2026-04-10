import { getSession } from "@/lib/auth";
import { deleteInvitation } from "@/lib/db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }
  const { id } = await params;
  deleteInvitation(Number(id));
  return Response.json({ success: true });
}
