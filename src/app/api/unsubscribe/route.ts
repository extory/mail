import { NextRequest } from "next/server";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";
import { unsubscribeByEmail } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { token } = await request.json();
  if (!token) {
    return Response.json({ error: "Token is required" }, { status: 400 });
  }

  const email = verifyUnsubscribeToken(token);
  if (!email) {
    return Response.json({ error: "Invalid or expired link" }, { status: 400 });
  }

  const success = unsubscribeByEmail(email);
  return Response.json({ success, email });
}
