import { getDb, getSendLogStats, getOverallStats } from "@/lib/db";
import { readPage, pageInfo } from "@/lib/server-pagination";
export async function GET(request: Request) {
  const total = (getDb().prepare("SELECT COUNT(*) as total FROM send_log").get() as {total:number}).total;
  const info = pageInfo(total, readPage(new URL(request.url).searchParams));
  return Response.json({...info, campaigns:getSendLogStats(info), overall:getOverallStats()});
}
