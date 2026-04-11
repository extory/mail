import { NextRequest } from "next/server";
import { generateEmailStream } from "@/lib/ai";

const BASE_URL = process.env.BASE_URL || "https://mail.extory.co";

export async function POST(request: NextRequest) {
  const { prompt, useName, imageUrls } = await request.json();

  if (!prompt) {
    return Response.json({ error: "Prompt is required" }, { status: 400 });
  }

  // Convert relative image paths to absolute URLs for AI
  const absoluteImageUrls = (imageUrls as string[] | undefined)?.map((url: string) =>
    url.startsWith("/") ? `${BASE_URL}${url}` : url
  );

  const stream = await generateEmailStream(prompt, {
    useName: useName === true,
    imageUrls: absoluteImageUrls,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
}
