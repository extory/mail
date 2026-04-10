import { getSendLogStats, getOverallStats } from "@/lib/db";

export async function GET() {
  const campaigns = getSendLogStats();
  const overall = getOverallStats();
  return Response.json({ campaigns, overall });
}
