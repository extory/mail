import { createHash } from "node:crypto";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import type { AIModel, AIModelCatalog, AIProvider, AIProviderModels, AISelection } from "./ai-model-types";

const TTL = 5 * 60 * 1000;
const cache = new Map<AIProvider, { key: string; expires: number; value: Promise<AIProviderModels> }>();

export class AISelectionError extends Error {}

export function providerKey(provider: AIProvider): string | undefined {
  const value = (provider === "openai" ? process.env.OPENAI_API_KEY : process.env.GEMINI_API_KEY)?.trim();
  return value && !/your[-_ ]?key|\.\.\.|^change-this/i.test(value) ? value : undefined;
}

export function isEmailModel(provider: AIProvider, id: string): boolean {
  // Model lists include audio, image, embedding and endpoint-specific models.
  if (/audio|image|vision|realtime|live|tts|transcrib|embedding|moderation|codex|search|research|computer|robotic|instruct|chat|custom|exp(?:-|$)/i.test(id)) return false;
  if (provider === "openai") return /^gpt-\d+(?:\.\d+)*(?:o)?(?:-|$)/.test(id) && !/(?:^|-)pro(?:-|$)/.test(id);
  return /^gemini-\d+(?:\.\d+)*-(?:pro|flash)(?:-|$)/.test(id);
}

function version(id: string): number[] {
  return (id.match(/^(?:gpt|gemini)-(\d+(?:\.\d+)*)/)?.[1] || "0").split(".").map(Number);
}

export function sortModels(models: AIModel[]): AIModel[] {
  return [...models].sort((a, b) => {
    const av = version(a.id), bv = version(b.id);
    for (let i = 0; i < Math.max(av.length, bv.length); i++) {
      const delta = (bv[i] || 0) - (av[i] || 0);
      if (delta) return delta;
    }
    // Same generation: stable before preview, then creation date / numeric ID.
    return Number(a.preview) - Number(b.preview) || (b.created || 0) - (a.created || 0)
      || b.id.localeCompare(a.id, "en", { numeric: true });
  });
}

async function fetchModels(provider: AIProvider, key: string): Promise<AIProviderModels> {
  const found: AIModel[] = [];
  if (provider === "openai") {
    const client = new OpenAI({ apiKey: key, timeout: 15000, maxRetries: 0 });
    for await (const model of client.models.list()) {
      if (isEmailModel(provider, model.id)) found.push({ id: model.id, name: model.id, created: model.created, preview: /preview|beta/.test(model.id) });
    }
  } else {
    const client = new GoogleGenAI({ apiKey: key, httpOptions: { timeout: 15000 } });
    const pager = await client.models.list({ config: { pageSize: 100 } });
    for await (const model of pager) {
      const id = model.name?.replace(/^models\//, "");
      if (id && model.supportedActions?.includes("generateContent") && isEmailModel(provider, id)) {
        found.push({ id, name: model.displayName || id, preview: /preview|beta/.test(id) });
      }
    }
  }
  const models = sortModels([...new Map(found.map(model => [model.id, model])).values()]);
  return { provider, configured: true, models, latest: models[0]?.id || null,
    ...(models.length ? {} : { error: "No compatible email models were returned by this provider." }) };
}

export async function getProviderModels(provider: AIProvider): Promise<AIProviderModels> {
  const key = providerKey(provider);
  if (!key) return { provider, configured: false, models: [], latest: null };
  const fingerprint = createHash("sha256").update(key).digest("hex");
  const current = cache.get(provider);
  if (current?.key === fingerprint && current.expires > Date.now()) return current.value;
  const value = fetchModels(provider, key).catch(() => {
    // Cache failures briefly to avoid bursts, but allow recovery without restart.
    const entry = cache.get(provider);
    if (entry?.key === fingerprint) entry.expires = Date.now() + 10000;
    return { provider, configured: true, models: [], latest: null,
      error: "Could not load models. Check this provider's API key and connection, then retry." };
  });
  cache.set(provider, { key: fingerprint, expires: Date.now() + TTL, value });
  return value;
}

export async function getModelCatalog(): Promise<AIModelCatalog> {
  return { providers: await Promise.all([getProviderModels("openai"), getProviderModels("gemini")]) };
}

export function parseAISelection(provider: unknown, model: unknown): AISelection {
  if (provider !== undefined && provider !== "openai" && provider !== "gemini") throw new AISelectionError("Invalid AI provider.");
  if (model !== undefined && (typeof model !== "string" || !model.trim() || model.length > 150)) throw new AISelectionError("Invalid AI model.");
  return { provider: provider as AIProvider | undefined, model: model as string | undefined };
}

export async function resolveAIModel(selection: AISelection = {}): Promise<{ provider: AIProvider; model: string }> {
  const provider = selection.provider || (providerKey("openai") ? "openai" : "gemini");
  const catalog = await getProviderModels(provider);
  if (!catalog.configured) throw new AISelectionError(`Set ${provider === "openai" ? "OPENAI_API_KEY" : "GEMINI_API_KEY"} on the server to use this provider.`);
  if (catalog.error) throw new AISelectionError(catalog.error);
  const configured = (provider === "openai" ? process.env.OPENAI_MODEL : process.env.GEMINI_MODEL)?.trim();
  const requested = selection.model || configured || "auto";
  const model = requested === "auto" ? catalog.latest : requested;
  if (!model || !catalog.models.some(item => item.id === model)) throw new AISelectionError("This model is not in the available email model list. Reload the list and choose another model.");
  return { provider, model };
}
