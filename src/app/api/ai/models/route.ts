import { getModelCatalog } from "@/lib/ai-models";

export async function GET() {
  return Response.json(await getModelCatalog(), { headers: { "Cache-Control": "no-store" } });
}
