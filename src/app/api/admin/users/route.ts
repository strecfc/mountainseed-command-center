import { z } from "zod";
import { createUser, inviteUrl, issuePasswordToken } from "@/lib/auth";
import { sql } from "@/lib/db";
import { json, readJson, requireAdmin } from "@/lib/http";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120),
  role: z.enum(["admin", "viewer"]),
  temporaryPassword: z.string().min(10).max(200).optional(),
  generateInvite: z.boolean().optional(),
});

export async function GET(req: Request) {
  const user = await requireAdmin(req);
  if (user instanceof Response) return user;
  const rows = await sql(
    "SELECT id, email, name, role, disabled, must_change_password, created_at FROM users ORDER BY created_at",
  );
  return json({ users: rows });
}

export async function POST(req: Request) {
  const user = await requireAdmin(req);
  if (user instanceof Response) return user;
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return json({ error: "Name, email, role, and either a temporary password (10+ characters) or an invite link are required." }, 400);
  const body = parsed.data;
  if (!body.temporaryPassword && !body.generateInvite) {
    return json({ error: "Set a temporary password or generate an invite link." }, 400);
  }
  try {
    const created = await createUser({
      email: body.email,
      name: body.name,
      role: body.role,
      password: body.temporaryPassword || `invite-${crypto.randomUUID()}`,
      mustChangePassword: true,
    });
    let invite: string | null = null;
    if (body.generateInvite || !body.temporaryPassword) {
      const token = await issuePasswordToken(created.id);
      const origin = req.headers.get("origin") || process.env.APP_BASE_URL;
      invite = inviteUrl(token, origin || undefined);
    }
    return json({ user: created, invite });
  } catch (error) {
    const message = error instanceof Error && /unique|duplicate/i.test(error.message) ? "That email already has an account." : "Could not create the account.";
    return json({ error: message }, 400);
  }
}
