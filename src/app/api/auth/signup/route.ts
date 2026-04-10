import { NextRequest } from "next/server";
import { signUp, ensureSuperUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  ensureSuperUser();
  const { email, password } = await request.json();
  if (!email || !password) {
    return Response.json({ error: "Email and password are required" }, { status: 400 });
  }
  if (password.length < 6) {
    return Response.json({ error: "Password must be at least 6 characters" }, { status: 400 });
  }
  const result = await signUp(email, password);
  if (result.error) {
    return Response.json({ error: result.error }, { status: 409 });
  }
  return Response.json(result);
}
