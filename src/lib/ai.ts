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

type Provider = "anthropic" | "gemini";

function getProvider(): Provider {
  if (process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY.includes("your-key")) {
    return "anthropic";
  }
  if (process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes("your-key")) {
    return "gemini";
  }
  throw new Error("No AI API key configured. Set ANTHROPIC_API_KEY or GEMINI_API_KEY in .env.local");
}

async function generateWithAnthropic(prompt: string, useName: boolean): Promise<ReadableStream> {
  const client = new Anthropic();
  const systemPrompt = useName ? SYSTEM_PROMPT + PERSONALIZED_ADDITION : SYSTEM_PROMPT;
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

async function generateWithGemini(prompt: string, useName: boolean): Promise<ReadableStream> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const encoder = new TextEncoder();
  const systemPrompt = useName ? SYSTEM_PROMPT + PERSONALIZED_ADDITION : SYSTEM_PROMPT;

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

export async function generateEmailStream(prompt: string, useName: boolean = false): Promise<ReadableStream> {
  const provider = getProvider();

  if (provider === "anthropic") {
    return generateWithAnthropic(prompt, useName);
  } else {
    return generateWithGemini(prompt, useName);
  }
}

export function getActiveProvider(): string {
  try {
    return getProvider();
  } catch {
    return "none";
  }
}
