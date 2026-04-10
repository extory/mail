import { NextRequest } from "next/server";
import { getGroups, addGroup } from "@/lib/db";

export async function GET() {
  const groups = getGroups();
  return Response.json(groups);
}

export async function POST(request: NextRequest) {
  const { name } = await request.json();
  if (!name) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }
  try {
    const group = addGroup(name);
    return Response.json(group);
  } catch {
    return Response.json({ error: "Group already exists" }, { status: 409 });
  }
}
