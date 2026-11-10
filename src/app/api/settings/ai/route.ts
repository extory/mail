import { getSession } from "@/lib/auth";
import { providerKey } from "@/lib/ai-models";
import { getAIProviderPreference, setAIProviderPreference } from "@/lib/ai-preferences";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const providers = (["openai", "gemini"] as const).map(provider => ({ provider, configured: Boolean(providerKey(provider)) }));
  const provider = getAIProviderPreference(session.id) || (providers.find(entry => entry.configured)?.provider || "openai");
  return Response.json({ provider, providers }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (body?.provider !== "openai" && body?.provider !== "gemini") return Response.json({ error: "invalid_provider" }, { status: 400 });
  if (!providerKey(body.provider)) return Response.json({ error: "missing_key" }, { status: 400 });
  setAIProviderPreference(session.id, body.provider);
  return Response.json({ provider: body.provider }, { headers: { "Cache-Control": "no-store" } });
}
