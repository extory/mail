import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const SENDER_EMAIL = process.env.SENDER_EMAIL || "onboarding@resend.dev";
const SENDER_NAME = process.env.SENDER_NAME || "Newsletter";

interface Recipient {
  email: string;
  name: string | null;
}

export async function sendBulkEmails(
  subject: string,
  htmlContent: string,
  recipients: Recipient[]
): Promise<{ success: number; failed: number; error?: string }> {
  const BATCH_SIZE = 100;
  let success = 0;
  let failed = 0;
  let lastError: string | undefined;

  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    const emails = batch.map((r) => ({
      from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
      to: [r.email],
      subject,
      html: htmlContent,
    }));

    try {
      const result = await resend.batch.send(emails);
      if (result.error) {
        console.error("[Resend batch error]", result.error);
        lastError = result.error.message;
        failed += batch.length;
      } else {
        success += batch.length;
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
