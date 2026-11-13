import { MappingForm, UploadForms } from "@/components/AdminForms";
import { requirePageAdmin } from "@/lib/current-user";
import { sql } from "@/lib/db";
import { activeBudgetMapping } from "@/lib/intake";

export default async function UploadsPage() {
  await requirePageAdmin();
  const metrics = await sql<{ label: string; section: string }>(
    "SELECT label, section FROM metric_definitions ORDER BY section, sort_order, label",
  );
  const mapping = await activeBudgetMapping();
  return (
    <>
      <div className="page-head"><div><h1>Uploads</h1><p>Weekly scorecard before the Wednesday L10, the monthly budget workbook, and a ValuTrac export when order detail is ready.</p></div></div>
      <UploadForms metrics={metrics} />
      <section className="section">
        <h2 className="section-title">Budget parser mapping</h2>
        <MappingForm mapping={mapping} />
      </section>
    </>
  );
}
