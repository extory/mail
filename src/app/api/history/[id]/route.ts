import { readPage } from "@/lib/server-pagination";
import { REPORT_FILTERS, type ReportFilter } from "@/lib/report-filters";
import { getSendReportPage } from "@/lib/send-tracking";
export async function GET(_request: Request, { params }: {params: Promise<{id:string}>}) {
  const {id} = await params;
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) return Response.json({error:"Invalid ID"},{status:400});
  const query = new URL(_request.url).searchParams;
  const filter = query.get("filter") || "all";
  if (!REPORT_FILTERS.includes(filter as ReportFilter)) return Response.json({error:"Invalid filter"},{status:400});
  const report = getSendReportPage(Number(id), readPage(query), filter as ReportFilter);
  return report ? Response.json(report,{headers:{"Cache-Control":"no-store"}}) : Response.json({error:"Not found"},{status:404});
}
