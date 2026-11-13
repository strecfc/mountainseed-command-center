import { json, requireAdmin } from "@/lib/http";
import { intakeBudget } from "@/lib/intake";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await requireAdmin(req);
  if (user instanceof Response) return user;
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "Choose a workbook." }, 400);
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > 15 * 1024 * 1024) return json({ error: "File is larger than 15 MB." }, 400);
  try {
    return json(await intakeBudget(buffer, file.name, user.email));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Could not parse the workbook." }, 400);
  }
}
