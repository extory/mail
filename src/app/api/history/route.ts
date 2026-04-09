import { getSendLogs } from "@/lib/db";

export async function GET() {
  const logs = getSendLogs();
  return Response.json(logs);
}
