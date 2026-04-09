import { NextRequest } from "next/server";
import { generateEmailStream } from "@/lib/ai";

export async function POST(request: NextRequest) {
  const { prompt } = await request.json();

  if (!prompt) {
    return Response.json({ error: "Prompt is required" }, { status: 400 });
  }

  const stream = await generateEmailStream(prompt);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
}
