import { NextRequest } from "next/server";
import { getSubscribers, addSubscriber, updateSubscriberGroup } from "@/lib/db";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get("search") || undefined;
  const groupParam = request.nextUrl.searchParams.get("groupId");
  const groupId = groupParam !== null ? Number(groupParam) : undefined;
  const subscribers = getSubscribers(search, groupId);
  return Response.json(subscribers);
}

export async function POST(request: NextRequest) {
  const { email, name, groupId } = await request.json();
  if (!email) {
    return Response.json({ error: "Email is required" }, { status: 400 });
  }
  const subscriber = addSubscriber(email, name, groupId);
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
