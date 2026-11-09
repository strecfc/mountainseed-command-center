import { json, requireUser } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await requireUser(req);
  if (user instanceof Response) return user;
  return json({ id: user.id, email: user.email, name: user.name, role: user.role });
}
