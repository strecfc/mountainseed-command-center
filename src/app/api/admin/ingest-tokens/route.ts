import { randomUUID } from "node:crypto";
import { hashToken, newToken } from "@/lib/auth";
import { sql } from "@/lib/db";
import { json, readJson, requireAdmin } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await requireAdmin(req);
  if (user instanceof Response) return user;
  const rows = await sql(
    "SELECT id, name, token_prefix, created_at, revoked_at FROM ingest_tokens ORDER BY created_at DESC",
  );
  return json({ tokens: rows });
}

export async function POST(req: Request) {
  const user = await requireAdmin(req);
  if (user instanceof Response) return user;
  const body = (await readJson(req)) as { name?: string } | null;
  const name = (body?.name || "Automation").trim().slice(0, 80);
  const token = newToken();
  await sql(
    "INSERT INTO ingest_tokens (id, name, token_hash, token_prefix, created_by) VALUES ($1, $2, $3, $4, $5)",
    [randomUUID(), name, hashToken(token), token.slice(0, 6), user.email],
  );
  return json({ token, name });
}
