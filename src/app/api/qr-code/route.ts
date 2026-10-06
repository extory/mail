import QRCode from "qrcode";
import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { normalizeQrLink } from "@/lib/qr-code";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const link = normalizeQrLink(body?.url);
  if (!link) return Response.json({ error: "invalid_link" }, { status: 400 });
  try {
    const png = await QRCode.toBuffer(link, { type: "png", errorCorrectionLevel: "M", margin: 4, scale: 8 });
    const filename = `${randomBytes(12).toString("hex")}.png`;
    const directory = path.join(process.cwd(), "public", "uploads");
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, filename), png);
    return Response.json({ url: `/uploads/${filename}`, link });
  } catch {
    return Response.json({ error: "qr_failed" }, { status: 500 });
  }
}
