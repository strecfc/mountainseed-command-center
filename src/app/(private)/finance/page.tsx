import { BackHome } from "@/components/BackHome";
import { FinanceBoardView } from "@/components/FinanceBoard";
import { ReadoutList } from "@/components/Metrics";
import { financeReadouts } from "@/lib/dashboard";
import { formatIsoDate } from "@/lib/format";

export default async function FinancePage() {
  const finance = await financeReadouts();
  return (
    <>
      <BackHome />
      <div className="page-head">
        <div>
          <h1>Finance</h1>
          <p>
            September budget vs actual, then the weekly cash and margin lines. Week ending{" "}
            {finance.featuredWeek ? formatIsoDate(finance.featuredWeek) : "Awaiting data"}.
          </p>
        </div>
      </div>
      {finance.budget ? <FinanceBoardView board={finance.budget} /> : <p>Awaiting data. Upload a budget vs actual file from Admin.</p>}
      <h2 className="section-title">Weekly scorecard</h2>
      <ReadoutList items={finance.readouts} />
    </>
  );
}
