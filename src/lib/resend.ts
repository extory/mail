import { Resend } from "resend";
import { buildUnsubscribeUrl, wrapHtmlWithUnsubscribeFooter } from "./unsubscribe";
import { saveSentEmail } from "./db";

const resend = new Resend(process.env.RESEND_API_KEY);

const SENDER_EMAIL = process.env.SENDER_EMAIL || "onboarding@resend.dev";
const SENDER_NAME = process.env.SENDER_NAME || "Newsletter";
const BASE_URL = process.env.BASE_URL || "https://mail.extory.co";

interface Recipient {
  email: string;
  name: string | null;
}

function stripCodeFences(text: string): string {
  return text
    .replace(/^\s*```[a-zA-Z]*\s*\n?/, "")
    .replace(/\n?\s*```\s*$/, "")
    .trim();
}

export async function sendBulkEmails(
  subject: string,
  htmlContent: string,
  recipients: Recipient[],
  sendLogId: number
): Promise<{ success: number; failed: number; error?: string }> {
  const BATCH_SIZE = 100;
  let success = 0;
  let failed = 0;
  let lastError: string | undefined;

  // Defensive: strip any residual markdown code fences
  htmlContent = stripCodeFences(htmlContent);

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    const emails = batch.map((r) => {
      const unsubUrl = buildUnsubscribeUrl(BASE_URL, r.email);
      // Replace {{name}} with actual subscriber name
      const personalizedContent = htmlContent.replace(
        /\{\{name\}\}/g,
        r.name || "Subscriber"
      );
      const html = wrapHtmlWithUnsubscribeFooter(personalizedContent, unsubUrl);
      return {
        from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
        to: [r.email],
        subject,
        html,
        headers: {
          "List-Unsubscribe": `<${unsubUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      };
    });

    try {
      const result = await resend.batch.send(emails);
      if (result.error) {
        console.error("[Resend batch error]", result.error);
        lastError = result.error.message;
        failed += batch.length;
      } else if (result.data) {
        success += batch.length;
        // Save each email ID for tracking
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
