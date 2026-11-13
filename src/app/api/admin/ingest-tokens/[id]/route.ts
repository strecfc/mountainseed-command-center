import { sql } from "@/lib/db";
import { json, requireAdmin } from "@/lib/http";

export const runtime = "nodejs";

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin(req);
  if (user instanceof Response) return user;
  const { id } = await ctx.params;
  await sql("UPDATE ingest_tokens SET revoked_at = now() WHERE id = $1", [id]);
  return json({ ok: true });
}
