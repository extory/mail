import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";

const SYSTEM_PROMPT = `You are an expert email newsletter writer. Generate a complete HTML email based on the user's topic.

Rules:
- Output the subject line on the FIRST line as: Subject: <subject here>
- Then a blank line
- Then the full HTML email body
- Output RAW HTML only. Do NOT wrap the output in markdown code fences (no \`\`\`html, no \`\`\`, no backticks at all).
- Do NOT include any explanatory text, preamble, or trailing comments — only the Subject line and the HTML body.
- Use inline CSS styles only (no <style> tags, no external CSS)
- Use a centered layout with max-width 600px
- Keep the design clean, modern, and professional
- Use a pleasant color scheme
- Make text readable with proper line-height and font sizing
- The HTML should render well across all email clients
- Write in the same language as the user's prompt`;

const PERSONALIZED_ADDITION = `
- IMPORTANT: Use {{name}} as a placeholder for the recipient's name. For example, start with a greeting like "안녕하세요 {{name}}님" or "Hello {{name}}". Use {{name}} naturally wherever you would address the recipient by name. Do NOT replace {{name}} with any actual name — keep it exactly as {{name}}.`;

export interface ImageInput {
  url: string;
  description?: string;
}

const IMAGE_ADDITION = (images: ImageInput[]) => `
- IMAGES: The user has uploaded ${images.length} image(s). You MUST include ALL of them in the email as <img> tags with the EXACT URLs below.
- Each image has a description explaining what it shows and/or where/how it should be used. Place each image according to its description, and write surrounding content that directly relates to what the image shows.
- If an image has no description, infer its role from context (hero image, product shot, inline illustration) and position it naturally.
- Use inline styles on every <img>: style="max-width:100%; height:auto; display:block; margin: 20px auto; border-radius: 8px;"
- Wrap each image in a container with appropriate spacing. You may add a <figcaption>-style caption based on the description if it adds value.
- The email body must meaningfully reference or describe the content of the images — do not just attach them without context.

Images provided:
${images.map((img, i) => `  [Image ${i + 1}]
    URL: ${img.url}
    ${img.description ? `Description / Intent: ${img.description}` : `Description: (none — infer from context)`}`).join("\n\n")}`;

type Provider = "anthropic" | "gemini";

interface GenerateOptions {
  useName?: boolean;
  images?: ImageInput[];
}

function buildSystemPrompt(options: GenerateOptions): string {
  let prompt = SYSTEM_PROMPT;
  if (options.useName) prompt += PERSONALIZED_ADDITION;
  if (options.images && options.images.length > 0) {
    prompt += IMAGE_ADDITION(options.images);
  }
  return prompt;
}

function getProvider(): Provider {
  if (process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY.includes("your-key")) {
    return "anthropic";
  }
  if (process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes("your-key")) {
    return "gemini";
  }
  throw new Error("No AI API key configured. Set ANTHROPIC_API_KEY or GEMINI_API_KEY in .env.local");
}

async function generateWithAnthropic(prompt: string, systemPrompt: string): Promise<ReadableStream> {
  const client = new Anthropic();
  const stream = client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: prompt }],
  });

  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

async function generateWithGemini(prompt: string, systemPrompt: string): Promise<ReadableStream> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      try {
        const stream = await ai.models.generateContentStream({
          model: "gemini-2.5-flash",
          contents: `${systemPrompt}\n\n${prompt}`,
        });

        for await (const chunk of stream) {
          const text = chunk.text;
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

export async function generateEmailStream(
  prompt: string,
  options: GenerateOptions = {}
): Promise<ReadableStream> {
  const provider = getProvider();
  const systemPrompt = buildSystemPrompt(options);

  if (provider === "anthropic") {
    return generateWithAnthropic(prompt, systemPrompt);
  } else {
    return generateWithGemini(prompt, systemPrompt);
  }
}

export function getActiveProvider(): string {
  try {
    return getProvider();
  } catch {
    return "none";
  }
}
