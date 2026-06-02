import { NextRequest } from "next/server";
import { getDraftRevision, deleteDraftRevision } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ revisionId: string }> }
) {
  const { revisionId } = await params;
  const id = Number(revisionId);
  if (!Number.isFinite(id)) {
    return Response.json({ error: "Invalid revision id" }, { status: 400 });
  }
  const revision = getDraftRevision(id);
  if (!revision) {
    return Response.json({ error: "Revision not found" }, { status: 404 });
  }
  return Response.json(revision);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ revisionId: string }> }
) {
  const { revisionId } = await params;
  const id = Number(revisionId);
  if (!Number.isFinite(id)) {
    return Response.json({ error: "Invalid revision id" }, { status: 400 });
  }
  deleteDraftRevision(id);
  return Response.json({ ok: true });
}
