import { cookieHeader, clientIp, login } from "@/lib/auth";
import { assertSameOrigin, json, readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const origin = assertSameOrigin(req);
  if (origin) return origin;
  const body = (await readJson(req)) as { email?: string; password?: string } | null;
  const result = await login(body?.email || "", body?.password || "", clientIp(req));
  if (!result.ok) return json({ error: result.error }, result.status);
  return json(
    { email: result.user.email, name: result.user.name, role: result.user.role },
    200,
    { "set-cookie": cookieHeader(result.token, req) },
  );
}
