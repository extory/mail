import { createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.JWT_SECRET || "dev-only-insecure-jwt-secret";

export function generateUnsubscribeToken(email: string): string {
  const hmac = createHmac("sha256", SECRET).update(email).digest("hex");
  const payload = Buffer.from(JSON.stringify({ email, sig: hmac })).toString("base64url");
  return payload;
}

export function verifyUnsubscribeToken(token: string): string | null {
  if (typeof token !== "string" || token.length > 2048) return null;
  try {
    const decoded = JSON.parse(Buffer.from(token, "base64url").toString());
    const { email, sig } = decoded;
    if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof sig !== "string" || !/^[a-f0-9]{64}$/.test(sig)) return null;
    const expected = createHmac("sha256", SECRET).update(email).digest("hex");
    if (timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))) return email;
    return null;
  } catch {
    return null;
  }
}

export function buildUnsubscribeUrl(baseUrl: string, email: string): string {
  const token = generateUnsubscribeToken(email);
  return `${baseUrl.replace(/\/$/, "")}/unsubscribe?token=${token}`;
}

export function buildOneClickUnsubscribeUrl(baseUrl: string, email: string): string {
  return `${baseUrl.replace(/\/$/, "")}/api/unsubscribe?token=${generateUnsubscribeToken(email)}`;
}

export function wrapHtmlWithUnsubscribeFooter(html: string, unsubscribeUrl: string, lang: "ko" | "en" = "ko"): string {
  // Templates and copied emails may contain invented mailto or old recipient links.
  // Replace only explicitly labelled unsubscribe links; preserve ordinary contact links.
  const escapedUrl = unsubscribeUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  html = html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (anchor, attrs: string, content: string) => {
    const label = content.replace(/<[^>]*>/g, "");
    if (!/수신\s*거부|구독\s*(?:취소|해지)|unsubscribe|opt[ -]?out/i.test(label + " " + attrs)) return anchor;
    const cleanAttrs = attrs.replace(/\s*href\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
    return `<a${cleanAttrs} href="${escapedUrl}">${content}</a>`;
  });
  const text = lang === "ko"
    ? "더 이상 이메일 수신을 원하지 않으시면"
    : "If you no longer wish to receive these emails";
  const linkText = lang === "ko" ? "수신거부" : "unsubscribe";

  const footer = `
<div style="margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb;text-align:center;">
  <p style="font-size:12px;color:#9ca3af;line-height:1.6;">
    ${text} <a href="${escapedUrl}" style="color:#6b7280;text-decoration:underline;">${linkText}</a>
  </p>
</div>`;

  // Insert before </body> if exists, otherwise append
  if (/<\/body\s*>/i.test(html)) {
    return html.replace(/<\/body\s*>/i, `${footer}</body>`);
  }
  return html + footer;
}
