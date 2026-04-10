import { isFirstUser } from "@/lib/auth";

export async function GET() {
  return Response.json({ firstUser: isFirstUser() });
}
