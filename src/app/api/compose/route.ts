import { NextRequest } from "next/server";
import { generateEmailStream, type ImageInput } from "@/lib/ai";

import { AISelectionError, parseAISelection } from "@/lib/ai-models";

const BASE_URL = process.env.BASE_URL || "https://mail.extory.co";

interface ImagePayload {
  url: string;
  description?: string;
}

export async function POST(request: NextRequest) {
  const { prompt, useName, images, provider, model } = await request.json();

  if (!prompt) {
    return Response.json({ error: "Prompt is required" }, { status: 400 });
  }

  // Convert relative image paths to absolute URLs for AI
  const absoluteImages: ImageInput[] | undefined = (images as ImagePayload[] | undefined)?.map((img) => ({
    url: img.url.startsWith("/") ? `${BASE_URL}${img.url}` : img.url,
    description: img.description,
  }));

  try {
    const ai = parseAISelection(provider, model);
    const stream = await generateEmailStream(prompt, {
      ...ai,
      useName: useName === true,
      images: absoluteImages,
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof AISelectionError ? error.message : "AI generation failed. Check model access and quota, or select another model." },
      { status: error instanceof AISelectionError ? 400 : 502 });
  }
}
