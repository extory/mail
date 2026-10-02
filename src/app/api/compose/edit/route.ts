import { NextRequest } from "next/server";
import { editSelection } from "@/lib/ai";

import { AISelectionError, parseAISelection } from "@/lib/ai-models";

export async function POST(request: NextRequest) {
  const { selection, instruction, provider, model } = await request.json();

  if (!selection || !instruction) {
    return Response.json(
      { error: "Selection and instruction are required" },
      { status: 400 }
    );
  }
  if (selection.length > 10000) {
    return Response.json({ error: "Selection too large" }, { status: 400 });
  }
  if (instruction.length > 1000) {
    return Response.json({ error: "Instruction too long" }, { status: 400 });
  }

  try {
    const result = await editSelection(selection, instruction, parseAISelection(provider, model));
    return Response.json({ result });
  } catch (err) {
    const msg = err instanceof AISelectionError ? err.message : "AI edit failed. Check model access and quota, or select another model.";
    return Response.json({ error: msg }, { status: err instanceof AISelectionError ? 400 : 502 });
  }
}
