import { NextRequest } from "next/server";
import { generateEmailStream, type ImageInput } from "@/lib/ai";

const BASE_URL = process.env.BASE_URL || "https://mail.extory.co";

interface ImagePayload {
  url: string;
  description?: string;
}

export async function POST(request: NextRequest) {
  const { prompt, useName, images } = await request.json();

  if (!prompt) {
    return Response.json({ error: "Prompt is required" }, { status: 400 });
  }

  // Convert relative image paths to absolute URLs for AI
  const absoluteImages: ImageInput[] | undefined = (images as ImagePayload[] | undefined)?.map((img) => ({
    url: img.url.startsWith("/") ? `${BASE_URL}${img.url}` : img.url,
    description: img.description,
  }));

  const stream = await generateEmailStream(prompt, {
    useName: useName === true,
    images: absoluteImages,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
}
