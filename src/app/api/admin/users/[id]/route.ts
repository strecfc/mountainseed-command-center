import { countAdmins, inviteUrl, issuePasswordToken, setTemporaryPassword } from "@/lib/auth";
import { sql } from "@/lib/db";
import { json, readJson, requireAdmin } from "@/lib/http";

export const runtime = "nodejs";

async function paramsId(ctx: { params: Promise<{ id: string }> }): Promise<string> {
  const { id } = await ctx.params;
  return id;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin(req);
  if (user instanceof Response) return user;
  const id = await paramsId(ctx);
  const body = (await readJson(req)) as {
    disabled?: boolean;
    role?: "admin" | "viewer";
    temporaryPassword?: string;
    generateInvite?: boolean;
  } | null;
  const existing = await sql<{ id: string; role: string; disabled: boolean }>("SELECT id, role, disabled FROM users WHERE id = $1", [id]);
  if (!existing[0]) return json({ error: "User not found." }, 404);
  if (body?.disabled === true || body?.role === "viewer") {
    if (existing[0].role === "admin" && !existing[0].disabled) {
      const admins = await countAdmins();
      if (admins <= 1) return json({ error: "Keep at least one active admin." }, 400);
    }
  }
  if (typeof body?.disabled === "boolean") {
    await sql("UPDATE users SET disabled = $1, updated_at = now() WHERE id = $2", [body.disabled, id]);
    if (body.disabled) await sql("DELETE FROM sessions WHERE user_id = $1", [id]);
  }
  if (body?.role === "admin" || body?.role === "viewer") {
    await sql("UPDATE users SET role = $1, updated_at = now() WHERE id = $2", [body.role, id]);
  }
  if (body?.temporaryPassword) {
    try {
      await setTemporaryPassword(id, body.temporaryPassword);
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : "Could not reset the password." }, 400);
    }
  }
  let invite: string | null = null;
  if (body?.generateInvite) {
    const token = await issuePasswordToken(id);
    invite = inviteUrl(token, req.headers.get("origin") || process.env.APP_BASE_URL);
  }
  return json({ ok: true, invite });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin(req);
  if (user instanceof Response) return user;
  const id = await paramsId(ctx);
  if (id === user.id) return json({ error: "You cannot delete the account you are signed in with." }, 400);
  const existing = await sql<{ role: string; disabled: boolean }>("SELECT role, disabled FROM users WHERE id = $1", [id]);
  if (!existing[0]) return json({ error: "User not found." }, 404);
  if (existing[0].role === "admin" && !existing[0].disabled && (await countAdmins()) <= 1) {
    return json({ error: "Keep at least one active admin." }, 400);
  }
  await sql("DELETE FROM users WHERE id = $1", [id]);
  return json({ ok: true });
}
