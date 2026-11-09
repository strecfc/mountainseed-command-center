import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { userForToken, type SessionUser } from "./auth";

export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  return userForToken(jar.get("ms_session")?.value);
}

export async function requirePageUser(): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requirePageAdmin(): Promise<SessionUser> {
  const user = await requirePageUser();
  if (user.role !== "admin") redirect("/");
  return user;
}
