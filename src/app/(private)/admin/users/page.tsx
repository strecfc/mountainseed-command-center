import { UsersAdmin } from "@/components/AdminForms";
import { requirePageAdmin } from "@/lib/current-user";
import { sql } from "@/lib/db";

export default async function UsersPage() {
  await requirePageAdmin();
  const users = await sql<{ id: string; email: string; name: string; role: "admin" | "viewer"; disabled: boolean }>(
    "SELECT id, email, name, role, disabled FROM users ORDER BY created_at",
  );
  return (
    <>
      <div className="page-head"><div><h1>People</h1><p>Only admins can add or change accounts. Viewers can see the scoreboard and nothing else on this page.</p></div></div>
      <UsersAdmin users={users} />
    </>
  );
}
