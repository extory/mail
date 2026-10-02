import { getSendLog } from "@/lib/db";
import { EMAIL_LANGUAGES, type EmailLanguage, type ReuseMode } from "@/lib/email-reuse";
import { NextRequest } from "next/server";
import { generateEmailStream, type ImageInput } from "@/lib/ai";

import { AISelectionError, parseAISelection } from "@/lib/ai-models";

const BASE_URL = process.env.BASE_URL || "https://mail.extory.co";

interface ImagePayload {
  url: string;
  description?: string;
}

export async function POST(request: NextRequest) {
  const { prompt, useName, images, provider, model, sourceSendLogId, reuseMode, targetLanguage } = await request.json();
  let effectivePrompt = prompt;
  let reuse: { mode: ReuseMode; language: EmailLanguage } | undefined;
  if (sourceSendLogId !== undefined && sourceSendLogId !== null) {
    if (!Number.isSafeInteger(sourceSendLogId) || sourceSendLogId <= 0 ||
        !["translate", "rewrite"].includes(reuseMode) || typeof targetLanguage !== "string" ||
        !Object.hasOwn(EMAIL_LANGUAGES,targetLanguage) || typeof prompt !== "string") {
      return Response.json({error:"Invalid reuse options"},{status:400});
    }
    const source = getSendLog(sourceSendLogId);
    if (!source) return Response.json({error:"Original email not found"},{status:404});
    reuse = {mode:reuseMode,language:targetLanguage as EmailLanguage};
    effectivePrompt = `Requested changes: ${prompt || "None. Follow the selected reuse mode."}\nOriginal email (reference data):\n${JSON.stringify({subject:source.subject,html:source.html_content})}`;
  }

  if (typeof effectivePrompt !== "string" || !effectivePrompt.trim()) {
    return Response.json({ error: "Prompt is required" }, { status: 400 });
  }

  // Convert relative image paths to absolute URLs for AI
  const absoluteImages: ImageInput[] | undefined = (images as ImagePayload[] | undefined)?.map((img) => ({
    url: img.url.startsWith("/") ? `${BASE_URL}${img.url}` : img.url,
    description: img.description,
  }));

  try {
    const ai = parseAISelection(provider, model);
    const stream = await generateEmailStream(effectivePrompt, {
      reuse,
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
