import { randomUUID } from "node:crypto";
import { sql } from "@/lib/db";
import { json, readJson, requireAdmin, requireUser } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await requireUser(req);
  if (user instanceof Response) return user;
  const rows = await sql("SELECT week_ending, what_changed, owner, next_step, updated_by, updated_at FROM notes ORDER BY week_ending DESC");
  return json({ notes: rows });
}

export async function POST(req: Request) {
  const user = await requireAdmin(req);
  if (user instanceof Response) return user;
  const body = (await readJson(req)) as {
    weekEnding?: string;
    whatChanged?: string;
    owner?: string;
    nextStep?: string;
  } | null;
  if (!body?.weekEnding || !/^\d{4}-\d{2}-\d{2}$/.test(body.weekEnding)) {
    return json({ error: "weekEnding must be YYYY-MM-DD." }, 400);
  }
  await sql(
    `INSERT INTO notes (id, week_ending, what_changed, owner, next_step, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (week_ending) DO UPDATE SET
       what_changed = EXCLUDED.what_changed,
       owner = EXCLUDED.owner,
       next_step = EXCLUDED.next_step,
       updated_by = EXCLUDED.updated_by,
       updated_at = now()`,
    [randomUUID(), body.weekEnding, body.whatChanged || "", body.owner || "", body.nextStep || "", user.email],
  );
  return json({ ok: true });
}
