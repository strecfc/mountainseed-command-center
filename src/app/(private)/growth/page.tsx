import { BackHome } from "@/components/BackHome";
import { SectionBlock } from "@/components/Metrics";
import { getDashboard } from "@/lib/dashboard";
import { formatUsd } from "@/lib/format";

export default async function GrowthPage() {
  const model = await getDashboard();
  const sf = model.salesforce;
  return (
    <>
      <BackHome />
      <div className="page-head">
        <div>
          <h1>Growth</h1>
          <p>New sales, upsell, and the M&A funnel. Salesforce figures appear here once a daily pull succeeds.</p>
        </div>
      </div>
      <div className="banner">
        <div>
          <strong>Salesforce: {sf.state === "not_connected" ? "Not connected" : sf.state}</strong>
          <div className="meta">Updated {sf.pulledAt || "Awaiting data"} · Salesforce</div>
        </div>
      </div>
      <div className="card-grid">
        <div className="panel"><b>Open pipeline</b><p className="headline" style={{ fontSize: 28 }}>{sf.pipelineAmount == null ? "Awaiting data" : formatUsd(sf.pipelineAmount)}</p><p className="meta">{sf.pipelineCount == null ? "" : `${sf.pipelineCount} opportunities`}</p></div>
        <div className="panel"><b>Wins, year to date</b><p className="headline" style={{ fontSize: 28 }}>{sf.winsAmount == null ? "Awaiting data" : formatUsd(sf.winsAmount)}</p><p className="meta">{sf.winsCount == null ? "" : `${sf.winsCount} won`}</p></div>
        <div className="panel"><b>New clients / upsell opps</b><p className="headline" style={{ fontSize: 28 }}>{sf.newClients == null ? "Awaiting data" : sf.newClients}</p><p className="meta">{sf.upsellCount == null ? "Upsell opportunities awaiting data" : `${sf.upsellCount} open upsell opportunities`}</p></div>
      </div>
      {sf.maStages ? (
        <div className="panel">
          <b>Salesforce M&A stages</b>
          <ul className="lines">
            {sf.maStages.map((stage) => (
              <li key={stage.stage}><span>{stage.stage}</span><strong>{stage.count}{stage.amount == null ? "" : ` · ${formatUsd(stage.amount)}`}</strong></li>
            ))}
          </ul>
        </div>
      ) : null}
      <SectionBlock title="New sales" items={model.newSales} />
      <SectionBlock title="Client upsell" items={model.upsell} />
      <SectionBlock title="M&A funnel" items={model.ma} />
    </>
  );
}
