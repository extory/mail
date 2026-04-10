import { getDashboardData } from "@/lib/db";

export async function GET() {
  return Response.json(getDashboardData());
}
