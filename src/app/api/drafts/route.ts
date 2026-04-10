import { NextRequest } from "next/server";
import { getDrafts, saveDraft } from "@/lib/db";

export async function GET() {
  return Response.json(getDrafts());
}

export async function POST(request: NextRequest) {
  const { subject, htmlContent, prompt, id } = await request.json();
  const draft = saveDraft(subject || "", htmlContent || "", prompt || "", id || undefined);
  return Response.json(draft);
}
