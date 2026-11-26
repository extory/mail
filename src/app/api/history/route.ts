import { getHistoryPage } from "@/lib/db";
import { readPage } from "@/lib/server-pagination";
export async function GET(request: Request) {
  return Response.json(getHistoryPage(readPage(new URL(request.url).searchParams)));
}
