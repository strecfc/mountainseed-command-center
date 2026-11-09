import { TargetsForm } from "@/components/AdminForms";
import { requirePageAdmin } from "@/lib/current-user";
import { sql } from "@/lib/db";

export default async function TargetsPage() {
  await requirePageAdmin();
  const targets = await sql<{ key: string; label: string; value_numeric: number | null; unit: string }>(
    "SELECT key, label, value_numeric, unit FROM targets ORDER BY key",
  );
  return (
    <>
      <div className="page-head"><div><h1>Targets</h1><p>These are the plan numbers the scoreboard compares against. They do not change historical scorecard goals unless a new scorecard is uploaded.</p></div></div>
      <TargetsForm targets={targets} />
    </>
  );
}
