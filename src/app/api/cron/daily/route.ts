import { tokensEqual } from "@/lib/auth";
import { json } from "@/lib/http";
import { runDailyPull } from "@/lib/salesforce";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET || "";
  const header = req.headers.get("authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "");
  if (!secret || !token || !tokensEqual(token, secret)) return json({ error: "Unauthorized" }, 401);
  const result = await runDailyPull();
  return json(result);
}
