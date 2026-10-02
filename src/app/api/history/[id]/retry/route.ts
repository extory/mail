import { getSendReport } from "@/lib/send-tracking";
import { retryUnsentEmails } from "@/lib/resend";
export async function POST(request: Request, { params }: {params: Promise<{id:string}>}) {
  const {id} = await params;
  const body = await request.json().catch(() => null);
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)) || body?.confirmed !== true) return Response.json({error:"Confirmation required"},{status:400});
  const report = getSendReport(Number(id));
  if (!report) return Response.json({error:"Not found"},{status:404});
  if (!report.tracked || report.busy) return Response.json({error:"Send unavailable or in progress"},{status:409});
  try { return Response.json(await retryUnsentEmails(Number(id))); }
  catch { return Response.json({error:"Send already in progress"},{status:409}); }
}
