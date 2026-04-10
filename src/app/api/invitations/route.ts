import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { createInvitation, getInvitations } from "@/lib/db";
import { randomBytes } from "crypto";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }
  return Response.json(getInvitations());
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return Response.json({ error: "Admin only" }, { status: 403 });
  }
  const { email } = await request.json();
  if (!email) {
    return Response.json({ error: "Email is required" }, { status: 400 });
  }
  const code = randomBytes(16).toString("hex");
  try {
    const invitation = createInvitation(email, code, session.id);
    return Response.json(invitation);
  } catch {
    return Response.json({ error: "Invitation already exists for this email" }, { status: 409 });
  }
}
