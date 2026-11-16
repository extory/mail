export type AdditionPosition = "start" | "end";
export type AdditionImage = { url: string; description: string };
const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export function appendEmailContent(html: string, text: string, images: AdditionImage[], position: AdditionPosition): string {
  if (!html.trim() || (!text.trim() && images.length === 0)) throw new Error("Empty content");
  if (text.length > 20000 || images.length > 10 || !["start", "end"].includes(position)) throw new Error("Invalid content");
  const paragraphs = text.trim() ? text.trim().split(/\r?\n\s*\r?\n/).map(paragraph =>
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#111827;">${escapeHtml(paragraph).replace(/\r?\n/g, "<br />")}</p>`).join("") : "";
  const pictures = images.map(image => {
    if (!/^\/uploads\/[a-zA-Z0-9-]+\.(?:png|jpg|jpeg|gif|webp)$/.test(image.url) || image.description.length > 1000) throw new Error("Invalid image");
    return `<img src="${image.url}" alt="${escapeHtml(image.description)}" width="552" style="display:block;width:100%;max-width:552px;height:auto;margin:16px auto;border:0;" />`;
  }).join("");
  const block = `<div style="max-width:600px;margin:0 auto;padding:24px;box-sizing:border-box;background:#ffffff;">${paragraphs}${pictures}</div>`;
  if (position === "start") {
    const opening = /<body\b[^>]*>/i.exec(html);
    if (opening) { const index = opening.index + opening[0].length; return html.slice(0,index) + block + html.slice(index); }
    return block + html;
  }
  // Keep a QR code and the service unsubscribe footer at the end.
  const qr = html.indexOf("<!-- mail-qr:start -->");
  const end = /<\/body\s*>|<\/html\s*>/i.exec(html)?.index ?? html.length;
  const index = qr >= 0 ? Math.min(qr,end) : end;
  return html.slice(0,index) + block + html.slice(index);
}
