import Link from "next/link";
import { SalesforceButton } from "@/components/AdminForms";
import { requirePageAdmin } from "@/lib/current-user";
import { sql } from "@/lib/db";
import { salesforceView } from "@/lib/salesforce";

export default async function AdminPage() {
  await requirePageAdmin();
  const uploads = await sql<{ kind: string; filename: string | null; status: string; message: string | null; created_at: string | Date }>(
    "SELECT kind, filename, status, message, created_at FROM uploads ORDER BY created_at DESC LIMIT 12",
  );
  const sf = await salesforceView();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Admin</h1>
          <p>People, weekly and monthly files, targets, and the token a future automation can use.</p>
        </div>
      </div>
      <div className="card-grid">
        <Link className="panel" href="/admin/users"><b>People</b><p>Create, disable, reset, or delete accounts.</p></Link>
        <Link className="panel" href="/admin/uploads"><b>Uploads</b><p>Scorecard, budget vs actual, and ValuTrac.</p></Link>
        <Link className="panel" href="/admin/targets"><b>Targets</b><p>2027 cases, margin, churn ceiling.</p></Link>
        <Link className="panel" href="/admin/ingest"><b>Ingest API</b><p>Create or revoke a bearer token.</p></Link>
      </div>
      <section className="section">
        <h2 className="section-title">Salesforce</h2>
        <SalesforceButton state={sf.state} message={sf.message} />
      </section>
      <section className="section">
        <h2 className="section-title">Recent files</h2>
        <div className="panel">
          {uploads.map((upload, index) => (
            <p key={`${upload.kind}-${index}`}>
              <strong>{upload.kind}</strong> · {upload.filename || "manual"} · {upload.status}
              <span className="meta"> {upload.message}</span>
            </p>
          ))}
        </div>
      </section>
    </>
  );
}
