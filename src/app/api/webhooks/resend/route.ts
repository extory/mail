import { NextRequest } from "next/server";
import { recordEmailEvent } from "@/lib/db";

// Resend webhook events
// Docs: https://resend.com/docs/dashboard/webhooks/introduction
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, data } = body;

    if (!type || !data?.email_id) {
      return Response.json({ error: "Invalid payload" }, { status: 400 });
    }

    // Map Resend event types to our event types
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

    // Store extra data for bounces and failures
    let extraData: string | undefined;
    if (data.bounce) {
      extraData = JSON.stringify(data.bounce);
    } else if (data.failed) {
      extraData = JSON.stringify(data.failed);
    } else if (data.click) {
      extraData = JSON.stringify(data.click);
    }

    recordEmailEvent(data.email_id, eventType, extraData);

    return Response.json({ ok: true, event: eventType });
  } catch (err) {
    console.error("[Webhook error]", err);
    return Response.json({ error: "Internal error" }, { status: 500 });
  }
}
