const START = "<!-- mail-qr:start -->";
const END = "<!-- mail-qr:end -->";
const BLOCK = /<!-- mail-qr:start -->[\s\S]*?<!-- mail-qr:end -->/g;

export function normalizeQrLink(input: unknown): string | null {
  if (typeof input !== "string" || input.trim().length > 1000) return null;
  try {
    const url = new URL(input.trim());
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    return url.href;
  } catch { return null; }
}

export function extractQrBlock(html: string): string {
  return html.match(BLOCK)?.[0] || "";
}

export function replaceQrBlock(html: string, block: string): string {
  const clean = html.replace(BLOCK, "");
  if (!block) return clean;
  if (/<\/body\s*>/i.test(clean)) return clean.replace(/<\/body\s*>/i, `${block}</body>`);
  return clean + block;
}

const escapeAttribute = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function createQrBlock(imageUrl: string, link?: string): string {
  if (!/^\/uploads\/[a-zA-Z0-9-]+\.(?:png|jpg|jpeg|gif|webp)$/.test(imageUrl)) throw new Error("Invalid QR image");
  const image = `<img src="${escapeAttribute(imageUrl)}" alt="QR code" width="240" style="display:block;width:240px;max-width:100%;height:auto;margin:0 auto;border:0;" />`;
  const url = normalizeQrLink(link);
  return `${START}<div style="padding:24px;text-align:center;background:#ffffff;">${url ? `<a href="${escapeAttribute(url)}">${image}</a>` : image}</div>${END}`;
}
