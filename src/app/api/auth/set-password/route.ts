import { consumePasswordToken } from "@/lib/auth";
import { assertSameOrigin, json, readJson } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const origin = assertSameOrigin(req);
  if (origin) return origin;
  const body = (await readJson(req)) as { token?: string; password?: string } | null;
  if (!body?.token) return json({ error: "Unauthorized" }, 401);
  const result = await consumePasswordToken(body.token, body.password || "");
  if (!result.ok) return json({ error: result.error }, 400);
  return json({ ok: true });
}
