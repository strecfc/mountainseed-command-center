import { randomUUID } from "node:crypto";
import { sql } from "@/lib/db";
import { json, readJson, requireAdmin } from "@/lib/http";
import { activeBudgetMapping } from "@/lib/intake";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await requireAdmin(req);
  if (user instanceof Response) return user;
  return json({ mapping: await activeBudgetMapping() });
}

export async function PUT(req: Request) {
  const user = await requireAdmin(req);
  if (user instanceof Response) return user;
  const body = (await readJson(req)) as { mapping?: unknown } | null;
  if (!body?.mapping || typeof body.mapping !== "object") return json({ error: "mapping object is required." }, 400);
  const mapping = body.mapping as { rowLabels?: unknown };
  if (!mapping.rowLabels || typeof mapping.rowLabels !== "object") {
    return json({ error: "mapping.rowLabels is required." }, 400);
  }
  await sql("UPDATE parser_mappings SET active = FALSE WHERE kind = 'budget'");
  await sql(
    "INSERT INTO parser_mappings (id, kind, name, config, active) VALUES ($1, 'budget', 'Custom budget mapping', $2, TRUE)",
    [randomUUID(), JSON.stringify(mapping)],
  );
  return json({ ok: true });
}
