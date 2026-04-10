import { NextRequest } from "next/server";
import { signUp, isFirstUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const { email, password, inviteCode } = await request.json();
  if (!email || !password) {
    return Response.json({ error: "Email and password are required" }, { status: 400 });
  }
  if (password.length < 6) {
    return Response.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }
  if (!isFirstUser() && !inviteCode) {
    return Response.json({ error: "Invitation code is required" }, { status: 400 });
  }
  const result = await signUp(email, password, inviteCode);
  if (result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json(result);
}
