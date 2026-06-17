import { getScheduledSends } from "@/lib/db";

export async function GET() {
  const sends = getScheduledSends();
  return Response.json(sends);
}
