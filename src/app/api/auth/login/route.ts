import { NextRequest } from "next/server";
import { signIn } from "@/lib/auth";
import { isValidEmail } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const { email, password } = await request.json();
  if (!email || !password) {
    return Response.json({ error: "Email and password are required" }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return Response.json({ error: "Invalid email format" }, { status: 400 });
  }
  const result = await signIn(email, password);
  if (result.error) {
    return Response.json({ error: result.error }, { status: 401 });
  }
  return Response.json(result);
}
