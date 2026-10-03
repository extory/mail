import { verifyUnsubscribeToken } from "@/lib/unsubscribe";
import { unsubscribeByEmail } from "@/lib/db";

// GET is safe for mail security scanners: it only opens the confirmation page.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token || !verifyUnsubscribeToken(token)) return Response.json({ error: "Invalid link" }, { status: 400 });
  return Response.redirect(new URL(`/unsubscribe?token=${encodeURIComponent(token)}`, request.url), 303);
}

export async function POST(request: Request) {
  try {
    const type = request.headers.get("content-type") || "";
    let token: unknown;
    if (type.includes("application/json")) {
      const body = await request.json();
      token = body?.token;
    } else {
      const form = await request.formData();
      if (form.get("List-Unsubscribe") !== "One-Click") return Response.json({ error: "Invalid request" }, { status: 400 });
      token = new URL(request.url).searchParams.get("token");
    }
    const email = typeof token === "string" ? verifyUnsubscribeToken(token) : null;
    if (!email) return Response.json({ error: "Invalid link" }, { status: 400 });
    unsubscribeByEmail(email);
    return Response.json({ success: true, email }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Unable to process unsubscribe request" }, { status: 400 });
  }
}
