import { NextRequest } from "next/server";
import { importSubscribers } from "@/lib/db";
import iconv from "iconv-lite";

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

// Detect encoding and decode CSV bytes to a string.
// Tries UTF-8 (including BOM); falls back to EUC-KR/CP949 if UTF-8 looks invalid.
function decodeCsv(buffer: Buffer): string {
  // UTF-8 BOM
  if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    return buffer.slice(3).toString("utf-8");
  }

  // Try UTF-8 strict — if it throws or contains replacement chars, treat as not UTF-8
  const utf8 = buffer.toString("utf-8");
  if (!utf8.includes("�") && isLikelyValidUtf8(buffer)) {
    return utf8;
  }

  // Fall back to CP949 (covers EUC-KR + extended Hangul, common in Excel-exported CSVs)
  return iconv.decode(buffer, "cp949");
}

// A byte sequence is valid UTF-8 if every multi-byte char follows UTF-8 rules.
function isLikelyValidUtf8(buf: Buffer): boolean {
  let i = 0;
  while (i < buf.length) {
    const b = buf[i];
    if (b < 0x80) { i++; continue; }
    let needed = 0;
    if ((b & 0xE0) === 0xC0) needed = 1;
    else if ((b & 0xF0) === 0xE0) needed = 2;
    else if ((b & 0xF8) === 0xF0) needed = 3;
    else return false;
    if (i + needed >= buf.length) return false;
    for (let j = 1; j <= needed; j++) {
      if ((buf[i + j] & 0xC0) !== 0x80) return false;
    }
    i += needed + 1;
  }
  return true;
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

  const buffer = Buffer.from(await file.arrayBuffer());
  const text = decodeCsv(buffer);
  const lines = text.replace(/\r\n/g, "\n").split("\n").filter((line) => line.trim());
  if (lines.length === 0) {
    return Response.json({ error: "Empty CSV" }, { status: 400 });
  }

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
