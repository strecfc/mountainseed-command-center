import { notFound } from "next/navigation";
import { BackHome } from "@/components/BackHome";
import { FinanceBoardView } from "@/components/FinanceBoard";
import { ReadoutList } from "@/components/Metrics";
import { financeReadouts, getDashboard, sectionReadouts } from "@/lib/dashboard";
import { formatIsoDate } from "@/lib/format";

const SECTIONS: Record<string, { title: string; lede: string; section?: string; finance?: boolean }> = {
  augur: {
    title: "Augur",
    lede: "Pipeline, closed-won ARR, retention, uptime, and client uploads from the leadership scorecard, plus the October uploads workbook.",
    section: "Augur",
  },
  "sales-leaseback": {
    title: "Sales Leaseback",
    lede: "Bank LOI value from the leadership scorecard.",
    section: "Sales Leaseback",
  },
  nbp: {
    title: "NBP",
    lede: "Partner participation, bids won, and discount per win.",
    section: "NBP",
  },
  finance: {
    title: "Finance",
    lede: "September budget vs actual from Max DiPlotti, then the weekly cash, margin, and turnover lines.",
    finance: true,
  },
};

export default async function SectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const spec = SECTIONS[slug];
  if (!spec) notFound();
  const finance = spec.finance ? await financeReadouts() : null;
  const section = spec.finance ? null : await sectionReadouts(spec.section || "");
  const data = finance || section;
  if (!data) notFound();
  const model = slug === "augur" ? await getDashboard() : null;
  return (
    <>
      <BackHome />
      <div className="page-head">
        <div>
          <h1>{spec.title}</h1>
          <p>{spec.lede} Week ending {data.featuredWeek ? formatIsoDate(data.featuredWeek) : "Awaiting data"}.</p>
        </div>
      </div>
      {finance?.budget ? <FinanceBoardView board={finance.budget} /> : null}
      {finance ? <h2 className="section-title">Weekly scorecard</h2> : null}
      <ReadoutList items={data.readouts} />
      {finance && !finance.budget ? (
        <div className="panel">
          <b>Latest monthly actuals</b>
          <p>{finance.monthly ? `${finance.monthly.filename || finance.monthly.period}` : "Awaiting data. Upload the budget vs actual workbook from Admin."}</p>
        </div>
      ) : null}
      {model?.augur ? (
        <section className="section">
          <h2 className="section-title">Closed-won workbook</h2>
          <p className="lede">
            {model.augur.asOf || "Augur uploads workbook"}
            {model.augur.weekOf ? ` · upload column ${model.augur.weekOf}` : ""}. Uploads total {model.augur.uploadsTotal ?? "Awaiting data"} versus weekly goal {model.augur.weeklyGoalTotal ?? "Awaiting data"}. Annual volume pre-October {model.augur.annualVolumePreOctober ?? "Awaiting data"}.
          </p>
          <div className="panel scroll">
            <table>
              <thead>
                <tr>
                  <th>Opportunity</th>
                  <th>Amount</th>
                  <th>Close</th>
                  <th>Expected / month</th>
                  <th>Uploads</th>
                </tr>
              </thead>
              <tbody>
                {model.augur.deals.map((deal) => (
                  <tr key={deal.opportunityName}>
                    <td>{deal.opportunityName}</td>
                    <td className="num">{deal.amount == null ? "—" : deal.amount.toLocaleString("en-US")}</td>
                    <td>{deal.closeDate || "—"}</td>
                    <td className="num">{deal.expectedMonthlyAppraisals ?? "—"}</td>
                    <td className="num">{deal.actualUploads ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="footer-meta">Source: Augur Uploads Goal (October) workbook · {model.augur.asOf || "Awaiting data"}</p>
          </div>
        </section>
      ) : null}
    </>
  );
}
