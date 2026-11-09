import { Counts, HeroGrid, SectionBlock } from "@/components/Metrics";
import { NotesForm } from "@/components/NotesForm";
import { requirePageUser } from "@/lib/current-user";
import { getDashboard } from "@/lib/dashboard";
import { formatUsd } from "@/lib/format";

export default async function HomePage() {
  const user = await requirePageUser();
  const model = await getDashboard();
  const sf = model.salesforce;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Are we on track?</h1>
          <p>Week ending {model.featuredLabel}. Colors compare this week, the trailing four weeks, and quarter-to-date pace with each goal.</p>
        </div>
        <Counts counts={model.counts} />
      </div>
      <div className="banner">
        <div>
          <strong>Salesforce: {sf.state === "not_connected" ? "Not connected" : sf.state}</strong>
          <div className="meta">{sf.message}</div>
        </div>
        <div className="meta">
          {sf.pulledAt ? `Last pull ${sf.pulledAt}` : "Daily pull has not run."}
          {sf.pipelineAmount != null ? ` · Open pipeline ${formatUsd(sf.pipelineAmount)}` : ""}
        </div>
      </div>
      <HeroGrid heroes={model.heroes} />
      <SectionBlock
        title="New sales"
        lede="Projected value of new AMC engagement letters plus upsell, SDR meetings, new-client order revenue, and closed-won."
        items={model.newSales}
      />
      <SectionBlock
        title="Client upsell"
        lede="Non-appraisal revenue against the 2027 target. Realization percent is the sales-scorecard proxy until dollar actuals arrive."
        items={model.upsell}
      />
      <SectionBlock
        title="M&A"
        lede="Funnel counts from the weekly scorecard. Diligence, closed revenue, and post-close retention are awaiting data."
        items={model.ma}
      />
      <SectionBlock
        title="Churn"
        lede="Logo churn and net retention from the scorecard. Account-level risk waits on Salesforce cases or an upload."
        items={model.defense}
      />
      <SectionBlock
        title="Operations"
        lede="QCR and CRR are on the scorecard today. The CRA versus fee-appraiser split fills in after a ValuTrac export."
        items={model.operations}
      />
      <section className="section">
        <h2 className="section-title">What changed</h2>
        <p className="lede">Week ending {model.featuredLabel}. The scorecard does not name a person per metric, so the owner lives here.</p>
        <NotesForm
          canEdit={user.role === "admin"}
          weekEnding={model.note?.weekEnding || model.featuredWeek || ""}
          whatChanged={model.note?.whatChanged || ""}
          owner={model.note?.owner || ""}
          nextStep={model.note?.nextStep || ""}
        />
      </section>
    </>
  );
}
