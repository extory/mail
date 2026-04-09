import { getActiveProvider } from "@/lib/ai";
import { getSubscriberCount } from "@/lib/db";

export async function GET() {
  return Response.json({
    aiProvider: getActiveProvider(),
    subscriberCount: getSubscriberCount(),
  });
}
