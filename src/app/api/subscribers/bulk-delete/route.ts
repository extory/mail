import { NextRequest } from "next/server";
import { deleteSubscribers } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { ids } = await request.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return Response.json({ error: "ids must be a non-empty array" }, { status: 400 });
  }
  const cleanIds = ids
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (cleanIds.length === 0) {
    return Response.json({ error: "No valid IDs" }, { status: 400 });
  }
  const deleted = deleteSubscribers(cleanIds);
  return Response.json({ deleted });
}
