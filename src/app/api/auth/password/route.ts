import { NextRequest } from "next/server";
import { getSession, changePassword } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { currentPassword, newPassword } = await request.json();
  if (!currentPassword || !newPassword) {
    return Response.json({ error: "Both passwords are required" }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return Response.json({ error: "New password must be at least 8 characters" }, { status: 400 });
  }

  const result = await changePassword(session.id, currentPassword, newPassword);
  if (result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json({ success: true });
}
