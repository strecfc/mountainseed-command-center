import { BackHome } from "@/components/BackHome";
import { NotesForm } from "@/components/NotesForm";
import { requirePageUser } from "@/lib/current-user";
import { sql } from "@/lib/db";
import { getDashboard } from "@/lib/dashboard";
import { formatIsoDate } from "@/lib/format";

export default async function NotesPage() {
  const user = await requirePageUser();
  const model = await getDashboard();
  const rows = await sql<{ week_ending: string | Date; what_changed: string; owner: string; next_step: string }>(
    "SELECT week_ending, what_changed, owner, next_step FROM notes ORDER BY week_ending DESC",
  );
  return (
    <>
      <BackHome />
      <div className="page-head">
        <div>
          <h1>What changed</h1>
          <p>A short note for the Wednesday L10: what moved, who owns it, and the next step.</p>
        </div>
      </div>
      <NotesForm
        canEdit={user.role === "admin"}
        weekEnding={model.note?.weekEnding || model.featuredWeek || ""}
        whatChanged={model.note?.whatChanged || ""}
        owner={model.note?.owner || ""}
        nextStep={model.note?.nextStep || ""}
      />
      <div className="panel" style={{ marginTop: 16 }}>
        <b>History</b>
        {rows.length ? (
          rows.map((row) => {
            const week = row.week_ending instanceof Date ? row.week_ending.toISOString().slice(0, 10) : String(row.week_ending).slice(0, 10);
            return (
              <p key={week}>
                <strong>{formatIsoDate(week)}</strong> · {row.owner || "No owner"} · {row.what_changed || "Awaiting data"} · Next: {row.next_step || "Awaiting data"}
              </p>
            );
          })
        ) : (
          <p>Awaiting data.</p>
        )}
      </div>
    </>
  );
}
