import { NextRequest } from "next/server";
import { getDrafts, saveDraft, deleteDrafts } from "@/lib/db";

export async function GET() {
  return Response.json(getDrafts());
}

export async function POST(request: NextRequest) {
  const { subject, htmlContent, prompt, id } = await request.json();
  const draft = saveDraft(subject || "", htmlContent || "", prompt || "", id || undefined);
  return Response.json(draft);
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => null);
  const ids = body?.ids;
  if (!Array.isArray(ids) || ids.length === 0 ||
      !ids.every(id => Number.isSafeInteger(id) && id > 0)) {
    return Response.json({ error: "Select valid draft IDs to delete." }, { status: 400 });
  }
  return Response.json({ deleted: deleteDrafts(ids) });
}
