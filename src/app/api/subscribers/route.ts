import { NextRequest } from "next/server";
import { getSubscribers, addSubscriber, updateSubscriberGroups } from "@/lib/db";
import { isValidEmail, sanitizeString } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get("search") || undefined;
  const groupParam = request.nextUrl.searchParams.get("groupId");
  const groupId = groupParam !== null ? Number(groupParam) : undefined;
  const subscribers = getSubscribers(search, groupId);
  return Response.json(subscribers);
}

function parseGroupIds(input: unknown): number[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0);
  }
  // Backward compat: single value
  const n = Number(input);
  return Number.isFinite(n) && n > 0 ? [n] : [];
}

export async function POST(request: NextRequest) {
  const { email, name, groupIds, groupId } = await request.json();
  if (!email || !isValidEmail(email)) {
    return Response.json({ error: "Valid email is required" }, { status: 400 });
  }
  const safeName = name ? sanitizeString(name, 200) : undefined;
  const ids = parseGroupIds(groupIds ?? groupId);
  const subscriber = addSubscriber(email, safeName, ids);
  return Response.json(subscriber);
}

export async function PATCH(request: NextRequest) {
  const { id, groupIds, groupId } = await request.json();
  if (!id) {
    return Response.json({ error: "Subscriber ID is required" }, { status: 400 });
  }
  const ids = parseGroupIds(groupIds ?? groupId);
  updateSubscriberGroups(id, ids);
  return Response.json({ success: true });
}
