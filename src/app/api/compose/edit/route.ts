import { NextRequest } from "next/server";
import { editSelection } from "@/lib/ai";

export async function POST(request: NextRequest) {
  const { selection, instruction } = await request.json();

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
    const result = await editSelection(selection, instruction);
    return Response.json({ result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Edit failed";
    return Response.json({ error: msg }, { status: 500 });
  }
}
