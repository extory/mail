export interface ImageLayout {
  placement?: "before" | "after" | "start" | "end";
  align?: "left" | "center" | "right";
  width?: number;
  beforeText?: string;
  afterText?: string;
  link?: string;
}

export function imageLayout(value: ImageLayout = {}) {
  const result = { placement: value.placement ?? "after", align: value.align ?? "center", width: value.width ?? 552,
    beforeText: value.beforeText ?? "", afterText: value.afterText ?? "", link: (value.link ?? "").trim() };
  if (!["before","after","start","end"].includes(result.placement) || !["left","center","right"].includes(result.align) ||
      !Number.isInteger(result.width) || result.width < 80 || result.width > 552 || result.link.length > 2000 || result.beforeText.length > 2000 || result.afterText.length > 2000) throw new Error("Invalid image layout");
  if (result.link) {
    const url = new URL(result.link);
    if (!["http:","https:"].includes(url.protocol) || url.username || url.password) throw new Error("Invalid image link");
    result.link = url.href;
  }
  return result;
}

export function imageGenerationDescription(description: string, options?: ImageLayout): string {
  if (!options) return description;
  const layout = imageLayout(options);
  return `${description}\nImage layout requirements (user data): ${JSON.stringify(layout)}\nPlacement: start/end means beginning/end of the email body; before/after means before/after the relevant explanatory text. Keep the specified width as a maximum, responsive on mobile; preserve aspect ratio without cropping. Include beforeText above and afterText below the image verbatim. Link the image only when link is provided.`;
}
