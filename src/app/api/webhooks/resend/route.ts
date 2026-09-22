import { NextRequest } from "next/server";
import { recordEmailEvent } from "@/lib/db";
import { Webhook } from "svix";

// Resend uses Svix for webhook signing. The "Signing Secret" shown in the
// Resend dashboard (whsec_...) must be set as RESEND_WEBHOOK_SECRET.
// Svix sends three headers: svix-id, svix-timestamp, svix-signature.

const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  try {
    if (!WEBHOOK_SECRET) return Response.json({ error: "Webhook not configured" }, { status: 503 });
    if (Number(request.headers.get("content-length")) > 262144) return Response.json({ error: "Payload too large" }, { status: 413 });
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = []; let bytes = 0;
    if (reader) {
      try {
        while (true) {
          const { done, value } = await reader.read(); if (done) break;
          bytes += value.byteLength;
          if (bytes > 262144) { await reader.cancel(); return Response.json({ error: "Payload too large" }, { status: 413 }); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
    }
    const rawBody = Buffer.concat(chunks).toString("utf8");

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
      } catch {
        console.error("[Webhook] Signature verification failed");
        return Response.json({ error: "Invalid signature" }, { status: 401 });
      }
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
  } catch {
    console.error("[Webhook] Request processing failed");
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
