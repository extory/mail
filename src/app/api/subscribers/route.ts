import { NextRequest } from "next/server";
import { getSubscribers, addSubscriber } from "@/lib/db";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get("search") || undefined;
  const subscribers = getSubscribers(search);
  return Response.json(subscribers);
}

export async function POST(request: NextRequest) {
  const { email, name } = await request.json();
  if (!email) {
    return Response.json({ error: "Email is required" }, { status: 400 });
  }
  const subscriber = addSubscriber(email, name);
  return Response.json(subscriber);
}
