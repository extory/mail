import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";

const SYSTEM_PROMPT = `You are an expert email newsletter writer. Generate a complete HTML email based on the user's topic.

Rules:
- Output the subject line on the FIRST line as: Subject: <subject here>
- Then a blank line
- Then the full HTML email body
- Use inline CSS styles only (no <style> tags, no external CSS)
- Use a centered layout with max-width 600px
- Keep the design clean, modern, and professional
- Use a pleasant color scheme
- Make text readable with proper line-height and font sizing
- The HTML should render well across all email clients
- Write in the same language as the user's prompt`;

const PERSONALIZED_ADDITION = `
- IMPORTANT: Use {{name}} as a placeholder for the recipient's name. For example, start with a greeting like "안녕하세요 {{name}}님" or "Hello {{name}}". Use {{name}} naturally wherever you would address the recipient by name. Do NOT replace {{name}} with any actual name — keep it exactly as {{name}}.`;

const IMAGE_ADDITION = (imageUrls: string[]) => `
- The following images have been provided. Include them in the email using <img> tags with the EXACT URLs below. Place them naturally within the email layout (as hero images, inline illustrations, etc.). Use inline styles: max-width:100%; height:auto; display:block;
${imageUrls.map((url, i) => `  Image ${i + 1}: ${url}`).join("\n")}`;

type Provider = "anthropic" | "gemini";

interface GenerateOptions {
  useName?: boolean;
  imageUrls?: string[];
}

function buildSystemPrompt(options: GenerateOptions): string {
  let prompt = SYSTEM_PROMPT;
  if (options.useName) prompt += PERSONALIZED_ADDITION;
  if (options.imageUrls && options.imageUrls.length > 0) {
    prompt += IMAGE_ADDITION(options.imageUrls);
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
