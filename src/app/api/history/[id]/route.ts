import { getSendReport } from "@/lib/send-tracking";
export async function GET(_request: Request, { params }: {params: Promise<{id:string}>}) {
  const {id} = await params;
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) return Response.json({error:"Invalid ID"},{status:400});
  const report = getSendReport(Number(id));
  return report ? Response.json(report,{headers:{"Cache-Control":"no-store"}}) : Response.json({error:"Not found"},{status:404});
}
