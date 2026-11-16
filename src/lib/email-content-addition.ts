import { imageLayout, type ImageLayout } from "./image-layout";
export type AdditionPosition = "start" | "end";
export type AdditionImage = { url: string; description: string; layout?: ImageLayout };
const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export function appendEmailContent(html: string, text: string, images: AdditionImage[], position: AdditionPosition): string {
  if (!html.trim() || (!text.trim() && images.length === 0)) throw new Error("Empty content");
  if (text.length > 20000 || images.length > 10 || !["start", "end"].includes(position)) throw new Error("Invalid content");
  const paragraphs = text.trim() ? text.trim().split(/\r?\n\s*\r?\n/).map(paragraph =>
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.7;color:#111827;">${escapeHtml(paragraph).replace(/\r?\n/g, "<br />")}</p>`).join("") : "";
  const groups: Record<string,string[]> = {before:[],after:[],start:[],end:[]};
  for (const image of images) {
    if (!/^\/uploads\/[a-zA-Z0-9-]+\.(?:png|jpg|jpeg|gif|webp)$/.test(image.url) || image.description.length > 1000) throw new Error("Invalid image");
    const layout = imageLayout(image.layout);
    const margin = layout.align === "left" ? "16px auto 16px 0" : layout.align === "right" ? "16px 0 16px auto" : "16px auto";
    const picture = `<img src="${image.url}" alt="${escapeHtml(image.description)}" width="${layout.width}" style="display:block;width:100%;max-width:${layout.width}px;height:auto;margin:${margin};border:0;" />`;
    const caption = (text: string) => text ? `<p style="margin:8px 0;font-size:16px;line-height:1.7;text-align:${layout.align};">${escapeHtml(text).replace(/\r?\n/g,"<br />")}</p>` : "";
    groups[layout.placement].push(caption(layout.beforeText) + (layout.link ? `<a href="${escapeHtml(layout.link)}">${picture}</a>` : picture) + caption(layout.afterText));
  }
  const wrap = (content: string) => content ? `<div style="max-width:600px;margin:0 auto;padding:24px;box-sizing:border-box;background:#ffffff;">${content}</div>` : "";
  const block = wrap(groups.before.join("") + paragraphs + groups.after.join(""));
  // Resolve all positions against the original content and preserve image order.
  const startBlock = wrap(groups.start.join("")) + (position === "start" ? block : "");
  const endBlock = (position === "end" ? block : "") + wrap(groups.end.join(""));
  const opening = /<body\b[^>]*>/i.exec(html);
  const startIndex = opening ? opening.index + opening[0].length : 0;
  const qr = html.indexOf("<!-- mail-qr:start -->");
  const end = /<\/body\s*>|<\/html\s*>/i.exec(html)?.index ?? html.length;
  const endIndex = qr >= 0 ? Math.min(qr,end) : end;
  return html.slice(0,startIndex) + startBlock + html.slice(startIndex,endIndex) + endBlock + html.slice(endIndex);
}
