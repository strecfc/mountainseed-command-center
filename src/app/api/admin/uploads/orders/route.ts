import { json, requireAdmin } from "@/lib/http";
import { intakeOrders } from "@/lib/intake";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await requireAdmin(req);
  if (user instanceof Response) return user;
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "Choose a CSV export." }, 400);
  const text = Buffer.from(await file.arrayBuffer()).toString("utf8");
  try {
    return json(await intakeOrders(text, file.name, user.email));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Could not parse the export." }, 400);
  }
}
