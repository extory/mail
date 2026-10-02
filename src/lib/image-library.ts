import { stat } from "node:fs/promises";
import path from "node:path";

export function imageMetadata(body: unknown): { name: string; description: string } | null {
  if (!body || typeof body !== "object") return null;
  const { name, description = "" } = body as Record<string, unknown>;
  if (typeof name !== "string" || !name.trim() || name.trim().length > 120) return null;
  if (typeof description !== "string" || description.length > 1000) return null;
  return { name: name.trim(), description: description.trim() };
}

export async function isExistingUpload(url: unknown): Promise<boolean> {
  if (typeof url !== "string" || !/^\/uploads\/[a-f0-9]{24}\.(?:jpe?g|png|gif|webp)$/.test(url)) return false;
  try {
    return (await stat(path.join(process.cwd(), "public", url))).isFile();
  } catch {
    return false;
  }
}
