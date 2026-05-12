import { NextRequest } from "next/server";
import { importSubscribers } from "@/lib/db";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  // Accept comma-separated group IDs (e.g. "3,7") or single ID
  const groupIdsRaw = formData.get("groupIds") as string | null;
  const legacyGroupId = formData.get("groupId") as string | null;
  const source = groupIdsRaw || legacyGroupId || "";
  const groupIds = source
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (!file) {
    return Response.json({ error: "CSV file is required" }, { status: 400 });
  }

  const text = await file.text();
  const lines = text.split("\n").filter((line) => line.trim());

  const rows: { email: string; name?: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (i === 0 && (line.toLowerCase().includes("email") || line.toLowerCase().includes("name"))) {
      continue;
    }
    const parts = line.split(",").map((p) => p.trim().replace(/^["']|["']$/g, ""));
    const email = parts[0];
    if (email && email.includes("@")) {
      rows.push({ email, name: parts[1] || undefined });
    }
  }

  const result = importSubscribers(rows, groupIds);
  return Response.json(result);
}
