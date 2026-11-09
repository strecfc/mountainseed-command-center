import type { SessionUser } from "./auth";
import { getUserFromRequest } from "./auth";

export function json(data: unknown, status = 200, extra?: HeadersInit): Response {
  const headers = new Headers(extra);
  headers.set("cache-control", "no-store");
  return Response.json(data, { status, headers });
}

export async function requireUser(req: Request): Promise<SessionUser | Response> {
  const user = await getUserFromRequest(req);
  if (!user) return json({ error: "Unauthorized" }, 401);
  return user;
}

export async function requireAdmin(req: Request): Promise<SessionUser | Response> {
  const user = await requireUser(req);
  if (user instanceof Response) return user;
  if (user.role !== "admin") return json({ error: "Forbidden" }, 403);
  return user;
}

export function assertSameOrigin(req: Request): Response | null {
  const origin = req.headers.get("origin");
  if (!origin) return null;
  const host = req.headers.get("host");
  if (!host) return json({ error: "Forbidden" }, 403);
  try {
    if (new URL(origin).host !== host) return json({ error: "Forbidden" }, 403);
  } catch {
    return json({ error: "Forbidden" }, 403);
  }
  return null;
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
