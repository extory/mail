import { NextRequest } from "next/server";
import { recordEmailEvent } from "@/lib/db";
import { createHmac } from "crypto";

const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;

function verifyWebhookSignature(payload: string, signature: string | null): boolean {
  if (!WEBHOOK_SECRET || !signature) return false;
  const expected = createHmac("sha256", WEBHOOK_SECRET).update(payload).digest("base64");
  return signature === expected;
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    // Verify webhook signature if secret is configured
    if (WEBHOOK_SECRET) {
      const signature = request.headers.get("x-resend-signature");
      if (!verifyWebhookSignature(rawBody, signature)) {
        return Response.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    const body = JSON.parse(rawBody);
    const { type, data } = body;

    if (!type || !data?.email_id) {
      return Response.json({ error: "Invalid payload" }, { status: 400 });
    }

    const eventMap: Record<string, string> = {
      "email.sent": "sent",
      "email.delivered": "delivered",
      "email.delivery_delayed": "delivery_delayed",
      "email.bounced": "bounced",
      "email.complained": "complained",
      "email.opened": "opened",
      "email.clicked": "clicked",
      "email.failed": "failed",
    };

    const eventType = eventMap[type];
    if (!eventType) {
      return Response.json({ ok: true, skipped: type });
    }

    let extraData: string | undefined;
    if (data.bounce) extraData = JSON.stringify(data.bounce);
    else if (data.failed) extraData = JSON.stringify(data.failed);
    else if (data.click) extraData = JSON.stringify(data.click);

    recordEmailEvent(data.email_id, eventType, extraData);

    return Response.json({ ok: true, event: eventType });
  } catch (err) {
    console.error("[Webhook error]", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
