import { sql } from "@/lib/db";
import { json, readJson, requireAdmin, requireUser } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await requireUser(req);
  if (user instanceof Response) return user;
  return json({ targets: await sql("SELECT key, label, value_numeric, unit, notes FROM targets ORDER BY key") });
}

export async function PUT(req: Request) {
  const user = await requireAdmin(req);
  if (user instanceof Response) return user;
  const body = (await readJson(req)) as { targets?: { key: string; value: number | null }[] } | null;
  if (!body?.targets?.length) return json({ error: "No targets were sent." }, 400);
  for (const target of body.targets) {
    if (!target.key) continue;
    await sql("UPDATE targets SET value_numeric = $1, updated_at = now() WHERE key = $2", [
      target.value == null || Number.isNaN(Number(target.value)) ? null : Number(target.value),
      target.key,
    ]);
  }
  return json({ ok: true });
}
