import { json, requireAdmin } from "@/lib/http";
import { runDailyPull } from "@/lib/salesforce";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await requireAdmin(req);
  if (user instanceof Response) return user;
  return json(await runDailyPull());
}
