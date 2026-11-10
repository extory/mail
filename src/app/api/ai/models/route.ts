import { getSession } from "@/lib/auth";
import { getAIProviderPreference } from "@/lib/ai-preferences";
import { getModelCatalog } from "@/lib/ai-models";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const catalog = await getModelCatalog();
  return Response.json({ ...catalog, defaultProvider: getAIProviderPreference(session.id) || catalog.providers.find(provider => provider.configured)?.provider || "openai" }, { headers: { "Cache-Control": "no-store" } });
}
