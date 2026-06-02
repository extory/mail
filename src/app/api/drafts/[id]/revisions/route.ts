import { NextRequest } from "next/server";
import { addDraftRevision, getDraftRevisions, getDraft } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const draftId = Number(id);
  if (!Number.isFinite(draftId)) {
    return Response.json({ error: "Invalid draft id" }, { status: 400 });
  }
  const draft = getDraft(draftId);
  if (!draft) {
    return Response.json({ error: "Draft not found" }, { status: 404 });
  }
  return Response.json(getDraftRevisions(draftId));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const draftId = Number(id);
  if (!Number.isFinite(draftId)) {
    return Response.json({ error: "Invalid draft id" }, { status: 400 });
  }
  const body = await request.json();
  const draft = getDraft(draftId);
  if (!draft) {
    return Response.json({ error: "Draft not found" }, { status: 404 });
  }
  const revision = addDraftRevision(
    draftId,
    typeof body.subject === "string" ? body.subject : "",
    typeof body.htmlContent === "string" ? body.htmlContent : "",
    typeof body.prompt === "string" ? body.prompt : "",
    typeof body.label === "string" ? body.label : undefined,
    typeof body.note === "string" ? body.note : undefined
  );
  return Response.json(revision);
}
