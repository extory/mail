import { recoverLegacySend } from "@/lib/send-tracking";
export async function POST(request: Request, { params }: {params: Promise<{id:string}>}) {
  const {id} = await params;
  const body = await request.json().catch(() => null);
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)) || body?.confirmed !== true ||
      !Array.isArray(body.emails) || body.emails.length > 10000 || !body.emails.every((email: unknown) => typeof email === "string")) return Response.json({error:"Original recipients and confirmation required"},{status:400});
  try { return Response.json(recoverLegacySend(Number(id),body.emails,body.embedImages === true)); }
  catch (error) { return Response.json({error: error instanceof Error ? error.message : "Recovery unavailable"},{status:409}); }
}
