import { NextRequest } from "next/server";
import { signUp, ensureSuperUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  ensureSuperUser();
  const { email, password, inviteCode } = await request.json();
  if (!email || !password || !inviteCode) {
    return Response.json({ error: "Email, password and invitation code are required" }, { status: 400 });
  }
  if (password.length < 6) {
    return Response.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }
  const result = await signUp(email, password, inviteCode);
  if (result.error) {
    return Response.json({ error: result.error }, { status: 400 });
  }
  return Response.json(result);
}
