import { NextRequest } from "next/server";
import { signIn, ensureSuperUser } from "@/lib/auth";

export async function POST(request: NextRequest) {
  ensureSuperUser();
  const { email, password } = await request.json();
  if (!email || !password) {
    return Response.json({ error: "Email and password are required" }, { status: 400 });
  }
  const result = await signIn(email, password);
  if (result.error) {
    return Response.json({ error: result.error }, { status: 401 });
  }
  return Response.json(result);
}
