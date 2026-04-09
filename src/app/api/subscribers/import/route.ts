import { NextRequest } from "next/server";
import { importSubscribers } from "@/lib/db";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return Response.json({ error: "CSV file is required" }, { status: 400 });
  }

  const text = await file.text();
  const lines = text.split("\n").filter((line) => line.trim());

  const rows: { email: string; name?: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Skip header row
    if (i === 0 && (line.toLowerCase().includes("email") || line.toLowerCase().includes("name"))) {
      continue;
    }
    const parts = line.split(",").map((p) => p.trim().replace(/^["']|["']$/g, ""));
    const email = parts[0];
    if (email && email.includes("@")) {
      rows.push({ email, name: parts[1] || undefined });
    }
  }

  const result = importSubscribers(rows);
  return Response.json(result);
}
