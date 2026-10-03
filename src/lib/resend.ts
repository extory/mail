import { randomUUID } from "node:crypto";
import { Resend, type CreateEmailOptions } from "resend";
import { buildUnsubscribeUrl, buildOneClickUnsubscribeUrl, wrapHtmlWithUnsubscribeFooter } from "./unsubscribe";
import { getSubscribers } from "./db";
import { initializeSend, getSendReport, claimSend, heartbeatSend, finishSend, setRecipientResult, recipientProblem, type TrackedRecipient } from "./send-tracking";
import { readFile } from "fs/promises";
import path from "path";

const client = () => new Resend(process.env.RESEND_API_KEY);

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
) {
  initializeSend(sendLogId, recipients, options.embedImages === true);
  return retryUnsentEmails(sendLogId);
}

export async function retryUnsentEmails(sendLogId: number) {
  const token = claimSend(sendLogId);
  if (!token) throw new Error("A send is already in progress");
  let lastError: string | undefined;
  try {
    const report = getSendReport(sendLogId)!;
    const resend = client();
    const htmlContent = stripCodeFences(report.log.html_content);
    const embedded = report.embedImages ? await embedImagesAsCid(htmlContent) : { html: htmlContent, attachments: [] };
    const candidates = report.recipients.filter(r => r.state === "pending" || r.state === "failed");
    const batchSize = embedded.attachments.length ? 1 : 100;
    for (let start = 0; start < candidates.length; start += batchSize) {
      heartbeatSend(sendLogId, token);
      const active = new Set(getSubscribers().map(s => s.email.toLowerCase()));
      const batch: TrackedRecipient[] = [];
      for (const recipient of candidates.slice(start,start+batchSize)) {
        const problem = recipientProblem(recipient.email);
        if (problem) setRecipientResult(recipient,"blocked",problem);
        else if (!active.has(recipient.email.toLowerCase())) setRecipientResult(recipient,"skipped","Subscriber removed, unsubscribed, or address changed");
        else batch.push(recipient);
      }
      if (!batch.length) continue;
      const emails: CreateEmailOptions[] = batch.map(r => {
        const unsubUrl = buildUnsubscribeUrl(BASE_URL,r.email);
        return { from: `${SENDER_NAME} <${SENDER_EMAIL}>`, to: [r.email], subject: report.log.subject,
          tags: [{ name: "send_log_id", value: String(sendLogId) }, { name: "recipient_id", value: String(r.id) }],
          html: wrapHtmlWithUnsubscribeFooter(embedded.html.replace(/\{\{name\}\}/g,r.name || "Subscriber"),unsubUrl),
          headers: { "List-Unsubscribe": `<${buildOneClickUnsubscribeUrl(BASE_URL, r.email)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
          ...(embedded.attachments.length ? { attachments: embedded.attachments } : {}),
        };
      });
      for (const recipient of batch) setRecipientResult(recipient,"sending");
      // Every known-rejected attempt gets a new key; uncertain attempts are never
      // resent automatically, including after Resend's 24-hour deduplication TTL.
      const idempotencyKey = `mail/${sendLogId}/${randomUUID()}`;
      try {
        const requestOptions = { idempotencyKey, signal: AbortSignal.timeout(120_000) };
        const response = embedded.attachments.length
          ? await resend.emails.send(emails[0], requestOptions)
          : await resend.batch.send(emails, { ...requestOptions, batchValidation: "permissive" });
        if (response.error) {
          const status = response.error.statusCode;
          const explicitRejections = ["validation_error", "rate_limit_exceeded", "daily_quota_exceeded", "monthly_quota_exceeded", "missing_api_key", "restricted_api_key", "invalid_api_key", "invalid_parameter", "missing_required_field"];
          const certainRejection = typeof status === "number"
            ? status >= 400 && status < 500 && status !== 408 && status !== 409
            : explicitRejections.includes(response.error.name);
          lastError = response.error.message;
          for (const recipient of batch) setRecipientResult(recipient,certainRejection ? "failed" : "unknown",lastError);
        } else {
          const data = response.data as {id?: string; data?: {id: string}[]; errors?: {index:number;message:string}[] } | null;
          const errors = data?.errors || [];
          const ids = embedded.attachments.length ? (data?.id ? [{id:data.id}] : []) : data?.data;
          const rejected = new Map(errors.map(error => [error.index,error.message]));
          if (!ids || rejected.size !== errors.length || errors.some(e => !Number.isInteger(e.index) || e.index < 0 || e.index >= batch.length) ||
              ids.length + errors.length !== batch.length || ids.some(item => !item.id)) {
            lastError = "Unrecognized provider response; verify with Resend before resending";
            for (const recipient of batch) setRecipientResult(recipient,"unknown",lastError);
          } else {
            let acceptedIndex = 0;
            for (let index = 0; index < batch.length; index++) {
              if (rejected.has(index)) {
                lastError = rejected.get(index)!;
                setRecipientResult(batch[index],"blocked",lastError);
              } else {
                setRecipientResult(batch[index],"accepted",undefined,ids[acceptedIndex++].id);
              }
            }
          }
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        for (const recipient of batch) {
          // Do not overwrite accepted rows if persistence failed partway through.
          const stored = getSendReport(sendLogId)!.recipients.find(r => r.id === recipient.id)!;
          if (stored.state === "sending") setRecipientResult(recipient,"unknown",lastError);
        }
      }
      if (start + batchSize < candidates.length) await new Promise(resolve => setTimeout(resolve,600));
    }
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
  } finally {
    finishSend(sendLogId,token);
  }
  const report = getSendReport(sendLogId)!;
  return { sendLogId, success: report.success, failed: report.total-report.success,
    total: report.total, retryable: report.retryable, blocked: report.blocked, unknown: report.unknown,
    status: report.log.status, error: lastError };
}
