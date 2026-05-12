import { NextRequest } from "next/server";
import { importSubscribers } from "@/lib/db";

// Parse a single CSV line respecting double-quoted fields (which may contain commas)
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { out.push(cur); cur = ""; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const groupIdsRaw = formData.get("groupIds") as string | null;
  const legacyGroupId = formData.get("groupId") as string | null;
  const source = groupIdsRaw || legacyGroupId || "";
  const defaultGroupIds = source
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (!file) {
    return Response.json({ error: "CSV file is required" }, { status: 400 });
  }

  const text = await file.text();
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((line) => line.trim());
  if (lines.length === 0) {
    return Response.json({ error: "Empty CSV" }, { status: 400 });
  }

  // Detect header row and column order
  // Supported columns (case-insensitive): email, name, groups (or "group")
  // Groups field may be semicolon, pipe, or vertical-bar separated.
  let emailIdx = 0;
  let nameIdx = 1;
  let groupsIdx = -1;
  let startIdx = 0;

  const firstParsed = parseCsvLine(lines[0]).map((s) => s.toLowerCase().replace(/^["']|["']$/g, ""));
  const hasHeader = firstParsed.some((c) => c === "email" || c === "name" || c === "group" || c === "groups");
  if (hasHeader) {
    emailIdx = firstParsed.indexOf("email");
    if (emailIdx === -1) emailIdx = 0;
    const nIdx = firstParsed.indexOf("name");
    nameIdx = nIdx === -1 ? -1 : nIdx;
    const gIdx = firstParsed.includes("groups")
      ? firstParsed.indexOf("groups")
      : firstParsed.indexOf("group");
    groupsIdx = gIdx;
    startIdx = 1;
  }

  const rows: { email: string; name?: string; groupNames?: string[] }[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const parts = parseCsvLine(lines[i]).map((p) => p.replace(/^["']|["']$/g, ""));
    const email = parts[emailIdx];
    if (!email || !email.includes("@")) continue;

    const name = nameIdx >= 0 ? parts[nameIdx] : undefined;
    let groupNames: string[] | undefined;
    if (groupsIdx >= 0 && parts[groupsIdx]) {
      // Split on ; | / to allow multiple groups per row
      groupNames = parts[groupsIdx]
        .split(/[;|/]/)
        .map((g) => g.trim())
        .filter(Boolean);
    }

    rows.push({ email, name: name || undefined, groupNames });
  }

  const result = importSubscribers(rows, defaultGroupIds);
  return Response.json(result);
}
