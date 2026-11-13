import { clearCookieHeader, destroySession, readCookie } from "@/lib/auth";
import { json, requireUser } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const user = await requireUser(req);
  if (user instanceof Response) return user;
  await destroySession(readCookie(req));
  return json({ ok: true }, 200, { "set-cookie": clearCookieHeader(req) });
}
