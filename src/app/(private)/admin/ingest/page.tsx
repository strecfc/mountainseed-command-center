import { IngestAdmin } from "@/components/AdminForms";
import { requirePageAdmin } from "@/lib/current-user";
import { sql } from "@/lib/db";

export default async function IngestPage() {
  await requirePageAdmin();
  const tokens = await sql<{ id: string; name: string; token_prefix: string; revoked_at: string | null }>(
    "SELECT id, name, token_prefix, revoked_at FROM ingest_tokens ORDER BY created_at DESC",
  );
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Ingest API</h1>
          <p>POST /api/ingest with Authorization: Bearer &lt;token&gt;. Datasets: weekly_scorecard, monthly_financials, budget_vs_actual, notes, orders, at_risk.</p>
        </div>
      </div>
      <IngestAdmin tokens={tokens} />
    </>
  );
}
