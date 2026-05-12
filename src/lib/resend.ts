import { Resend } from "resend";
import { buildUnsubscribeUrl, wrapHtmlWithUnsubscribeFooter } from "./unsubscribe";
import { saveSentEmail } from "./db";
import { readFile } from "fs/promises";
import path from "path";

const resend = new Resend(process.env.RESEND_API_KEY);

const SENDER_EMAIL = process.env.SENDER_EMAIL || "onboarding@resend.dev";
const SENDER_NAME = process.env.SENDER_NAME || "Newsletter";
const BASE_URL = process.env.BASE_URL || "https://mail.extory.co";

interface Recipient {
  email: string;
  name: string | null;
}

interface ResendAttachment {
  filename: string;
  content: string; // base64
  content_id?: string;
  disposition?: "inline" | "attachment";
  content_type?: string;
}

function stripCodeFences(text: string): string {
  return text
    .replace(/^\s*```[a-zA-Z]*\s*\n?/, "")
    .replace(/\n?\s*```\s*$/, "")
    .trim();
}

function mimeTypeFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png": return "image/png";
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "gif": return "image/gif";
    case "webp": return "image/webp";
    default: return "application/octet-stream";
  }
}

/**
 * Convert local /uploads/ image references to CID attachments for better
 * Outlook compatibility. Replaces <img src="..."> URLs (relative or
 * absolute matching BASE_URL) with <img src="cid:imgN"> and returns the
 * attachments to include with the email.
 */
async function embedImagesAsCid(html: string): Promise<{ html: string; attachments: ResendAttachment[] }> {
  const attachments: ResendAttachment[] = [];
  const uploadsDir = path.join(process.cwd(), "public", "uploads");

  // Match src="..." pointing to /uploads/ (relative) or ${BASE_URL}/uploads/
  const pattern = new RegExp(
    `src=["'](?:${BASE_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})?/uploads/([^"'?#]+)["']`,
    "g"
  );

  const matches = Array.from(html.matchAll(pattern));
  const seen = new Map<string, string>(); // filename -> content_id

  for (const match of matches) {
    const filename = match[1];
    if (seen.has(filename)) continue;

    try {
      const buffer = await readFile(path.join(uploadsDir, filename));
      const contentId = `img${attachments.length + 1}`;
      attachments.push({
        filename,
        content: buffer.toString("base64"),
        content_id: contentId,
        disposition: "inline",
        content_type: mimeTypeFromFilename(filename),
      });
      seen.set(filename, contentId);
    } catch {
      // File missing — leave the src as-is
    }
  }

  // Replace all matched src attributes with cid: references
  let result = html;
  for (const [filename, cid] of seen.entries()) {
    const replacePattern = new RegExp(
      `src=["'](?:${BASE_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})?/uploads/${filename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`,
      "g"
    );
    result = result.replace(replacePattern, `src="cid:${cid}"`);
  }

  return { html: result, attachments };
}

export async function sendBulkEmails(
  subject: string,
  htmlContent: string,
  recipients: Recipient[],
  sendLogId: number,
  options: { embedImages?: boolean } = {}
): Promise<{ success: number; failed: number; error?: string }> {
  const BATCH_SIZE = 100;
  let success = 0;
  let failed = 0;
  let lastError: string | undefined;

  // Defensive: strip any residual markdown code fences
  htmlContent = stripCodeFences(htmlContent);

  // If CID embedding requested, prepare HTML + attachments once
  // (same for every recipient — content is identical except {{name}})
  let cidHtml: string | null = null;
  let cidAttachments: ResendAttachment[] = [];
  if (options.embedImages) {
    const result = await embedImagesAsCid(htmlContent);
    cidHtml = result.html;
    cidAttachments = result.attachments;
  }

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    const emails = batch.map((r) => {
      const unsubUrl = buildUnsubscribeUrl(BASE_URL, r.email);
      const baseContent = cidHtml ?? htmlContent;
      const personalizedContent = baseContent.replace(/\{\{name\}\}/g, r.name || "Subscriber");
      const html = wrapHtmlWithUnsubscribeFooter(personalizedContent, unsubUrl);
      const payload: Record<string, unknown> = {
        from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
        to: [r.email],
        subject,
        html,
        headers: {
          "List-Unsubscribe": `<${unsubUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      };
      if (cidAttachments.length > 0) {
        payload.attachments = cidAttachments;
      }
      return payload;
    });

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await resend.batch.send(emails as any);
      if (result.error) {
        console.error("[Resend batch error]", result.error);
        lastError = result.error.message;
        failed += batch.length;
      } else if (result.data) {
        success += batch.length;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const dataArr = (result.data as any).data ?? result.data;
        for (let j = 0; j < dataArr.length; j++) {
          if (dataArr[j]?.id) {
            saveSentEmail(sendLogId, dataArr[j].id, batch[j].email);
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[Resend exception]", msg);
      lastError = msg;
      failed += batch.length;
    }

    if (i + BATCH_SIZE < recipients.length) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  return { success, failed, error: lastError };
}
