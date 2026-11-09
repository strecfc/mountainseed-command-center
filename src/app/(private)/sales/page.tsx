import { BackHome } from "@/components/BackHome";
import { SectionBlock } from "@/components/Metrics";
import { getDashboard } from "@/lib/dashboard";
import { formatUsd } from "@/lib/format";

export default async function SalesPage() {
  const model = await getDashboard();
  const sf = model.salesforce;
  const connected = sf.state !== "not_connected" && sf.state !== "awaiting";
  return (
    <>
      <BackHome />
      <div className="page-head">
        <div>
          <h1>New sales</h1>
          <p>
            New engagement-letter value is from the MarketPlace Sales Scorecard. Dollar client upsell is not split out
            on that scorecard or the September budget.
          </p>
        </div>
      </div>
      <SectionBlock title="New sales" items={model.newSales} />
      <SectionBlock title="Client upsell" items={model.upsell} />
      <section className="section" id="pipeline">
        <h2 className="section-title">Salesforce</h2>
        {connected ? (
          <div className="card-grid">
            <div className="panel">
              <b>New sales won, year to date</b>
              <p className="headline" style={{ fontSize: 28 }}>{sf.newSalesWonYtd == null ? "Awaiting data" : formatUsd(sf.newSalesWonYtd)}</p>
              <p className="meta">This month {sf.newSalesWonMonth == null ? "Awaiting data" : formatUsd(sf.newSalesWonMonth)}. Won opportunities whose Type is not Existing Business.</p>
            </div>
            <div className="panel">
              <b>Upsell won, year to date</b>
              <p className="headline" style={{ fontSize: 28 }}>{sf.upsellWonYtd == null ? "Awaiting data" : formatUsd(sf.upsellWonYtd)}</p>
              <p className="meta">This month {sf.upsellWonMonth == null ? "Awaiting data" : formatUsd(sf.upsellWonMonth)}. Won opportunities whose Type is Existing Business.</p>
            </div>
            <div className="panel">
              <b>Open pipeline</b>
              <p className="headline" style={{ fontSize: 28 }}>{sf.pipelineAmount == null ? "Awaiting data" : formatUsd(sf.pipelineAmount)}</p>
            </div>
          </div>
        ) : (
          <div className="panel">
            <p>Awaiting data: Salesforce. New sales are won opportunities whose Type is not Existing Business, for the year and the month. Client upsell is won opportunities whose Type is Existing Business. Open pipeline appears here once the org is connected.</p>
          </div>
        )}
      </section>
    </>
  );
}
