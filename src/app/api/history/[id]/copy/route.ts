import { copySendToDraft } from "@/lib/db";

export async function POST(_request: Request, { params }: {params: Promise<{id: string}>}) {
  const {id} = await params;
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) return Response.json({error:"Invalid ID"},{status:400});
  const draft = copySendToDraft(Number(id));
  return draft ? Response.json(draft,{status:201}) : Response.json({error:"Email not found"},{status:404});
}
