import { createHmac } from "crypto";

const SECRET = process.env.JWT_SECRET || "mail-service-secret-key-change-in-production";

export function generateUnsubscribeToken(email: string): string {
  const hmac = createHmac("sha256", SECRET).update(email).digest("hex");
  const payload = Buffer.from(JSON.stringify({ email, sig: hmac })).toString("base64url");
  return payload;
}

export function verifyUnsubscribeToken(token: string): string | null {
  try {
    const decoded = JSON.parse(Buffer.from(token, "base64url").toString());
    const { email, sig } = decoded;
    const expected = createHmac("sha256", SECRET).update(email).digest("hex");
    if (sig === expected) return email;
    return null;
  } catch {
    return null;
  }
}

export function buildUnsubscribeUrl(baseUrl: string, email: string): string {
  const token = generateUnsubscribeToken(email);
  return `${baseUrl}/unsubscribe?token=${token}`;
}

export function wrapHtmlWithUnsubscribeFooter(html: string, unsubscribeUrl: string, lang: "ko" | "en" = "ko"): string {
  const text = lang === "ko"
    ? "더 이상 이메일 수신을 원하지 않으시면"
    : "If you no longer wish to receive these emails";
  const linkText = lang === "ko" ? "수신거부" : "unsubscribe";

  const footer = `
<div style="margin-top:40px;padding-top:20px;border-top:1px solid #e5e7eb;text-align:center;">
  <p style="font-size:12px;color:#9ca3af;line-height:1.6;">
    ${text} <a href="${unsubscribeUrl}" style="color:#6b7280;text-decoration:underline;">${linkText}</a>
  </p>
</div>`;

  // Insert before </body> if exists, otherwise append
  if (html.includes("</body>")) {
    return html.replace("</body>", `${footer}</body>`);
  }
  return html + footer;
}
