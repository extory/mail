import { NextRequest } from "next/server";
import { recordEmailEvent } from "@/lib/db";
import { Webhook } from "svix";

// Resend uses Svix for webhook signing. The "Signing Secret" shown in the
// Resend dashboard (whsec_...) must be set as RESEND_WEBHOOK_SECRET.
// Svix sends three headers: svix-id, svix-timestamp, svix-signature.

const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    let payload: unknown;

    if (WEBHOOK_SECRET) {
      const headers = {
        "svix-id": request.headers.get("svix-id") || "",
        "svix-timestamp": request.headers.get("svix-timestamp") || "",
        "svix-signature": request.headers.get("svix-signature") || "",
      };

      if (!headers["svix-id"] || !headers["svix-timestamp"] || !headers["svix-signature"]) {
        console.error("[Webhook] Missing svix headers");
        return Response.json({ error: "Missing signature headers" }, { status: 401 });
      }

      try {
        const wh = new Webhook(WEBHOOK_SECRET);
        payload = wh.verify(rawBody, headers);
      } catch (err) {
        console.error("[Webhook] Signature verification failed:", {
          error: err instanceof Error ? err.message : String(err),
          secretLength: WEBHOOK_SECRET.length,
          secretPrefix: WEBHOOK_SECRET.slice(0, 8),
          headers: {
            id: headers["svix-id"],
            timestamp: headers["svix-timestamp"],
            signaturePrefix: headers["svix-signature"]?.slice(0, 30),
          },
          bodyLength: rawBody.length,
        });
        return Response.json({ error: "Invalid signature" }, { status: 401 });
      }
    } else {
      payload = JSON.parse(rawBody);
    }

    const { type, data } = payload as { type: string; data: { email_id?: string; bounce?: unknown; failed?: unknown; click?: unknown } };

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
