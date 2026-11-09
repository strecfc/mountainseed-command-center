import { json, requireUser } from "@/lib/http";
import { salesforceView } from "@/lib/salesforce";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await requireUser(req);
  if (user instanceof Response) return user;
  return json(await salesforceView());
}
