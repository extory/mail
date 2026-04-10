import { NextRequest } from "next/server";
import { getSubscribers, addSubscriber, updateSubscriberGroup } from "@/lib/db";
import { isValidEmail, sanitizeString } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get("search") || undefined;
  const groupParam = request.nextUrl.searchParams.get("groupId");
  const groupId = groupParam !== null ? Number(groupParam) : undefined;
  const subscribers = getSubscribers(search, groupId);
  return Response.json(subscribers);
}

export async function POST(request: NextRequest) {
  const { email, name, groupId } = await request.json();
  if (!email || !isValidEmail(email)) {
    return Response.json({ error: "Valid email is required" }, { status: 400 });
  }
  const safeName = name ? sanitizeString(name, 200) : undefined;
  const subscriber = addSubscriber(email, safeName, groupId);
  return Response.json(subscriber);
}

export async function PATCH(request: NextRequest) {
  const { id, groupId } = await request.json();
  if (!id) {
    return Response.json({ error: "Subscriber ID is required" }, { status: 400 });
  }
  updateSubscriberGroup(id, groupId ?? null);
  return Response.json({ success: true });
}
