import { NextRequest } from "next/server";
import { importSubscribers } from "@/lib/db";
import iconv from "iconv-lite";
import { readSheet } from "read-excel-file/node";

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
  const formData = await request.formData().catch(() => null);
  if (!formData) return Response.json({ error: "invalid_file" }, { status: 400 });
  const file = formData.get("file");
  const groupIdsRaw = formData.get("groupIds");
  const legacyGroupId = formData.get("groupId");
  const source = typeof groupIdsRaw === "string" ? groupIdsRaw : typeof legacyGroupId === "string" ? legacyGroupId : "";
  const defaultGroupIds = source
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (!(file instanceof File) || !/\.(csv|xlsx)$/i.test(file.name)) {
    return Response.json({ error: "unsupported_format" }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) return Response.json({ error: "file_too_large" }, { status: 400 });
  let data: string[][];
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    data = /\.xlsx$/i.test(file.name)
      ? (await readSheet(buffer, 1)).map(row => row.map(cell => cell == null ? "" : String(cell).trim()))
      : decodeCsv(buffer).replace(/\r\n/g, "\n").split("\n").filter(line => line.trim()).map(parseCsvLine);
    data = data.filter(row => row.some(cell => cell.trim()));
  } catch {
    return Response.json({ error: "invalid_file" }, { status: 400 });
  }
  if (data.length === 0) return Response.json({ error: "empty_file" }, { status: 400 });

  let emailIdx = 0;
  let nameIdx = 1;
  let groupsIdx = -1;
  let startIdx = 0;

  const aliases: Record<string, string> = { "이메일": "email", "이메일 주소": "email", "이름": "name", "그룹": "groups" };
  const firstParsed = data[0].map(cell => {
    const value = cell.toLowerCase().replace(/^["']|["']$/g, "").trim();
    return aliases[value] || value;
  });
  const hasHeader = firstParsed.some((c) => c === "email" || c === "name" || c === "group" || c === "groups");
  if (hasHeader) {
    emailIdx = firstParsed.indexOf("email");
    if (emailIdx === -1) return Response.json({ error: "missing_email_column" }, { status: 400 });
    const nIdx = firstParsed.indexOf("name");
    nameIdx = nIdx === -1 ? -1 : nIdx;
    const gIdx = firstParsed.includes("groups")
      ? firstParsed.indexOf("groups")
      : firstParsed.indexOf("group");
    groupsIdx = gIdx;
    startIdx = 1;
  }

  const rows: { email: string; name?: string; groupNames?: string[] }[] = [];
  for (let i = startIdx; i < data.length; i++) {
    const parts = data[i];
    const email = parts[emailIdx];
    if (!email) continue;

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

  if (rows.length === 0) return Response.json({ error: "empty_file" }, { status: 400 });
  const result = importSubscribers(rows, defaultGroupIds);
  return Response.json(result);
}
