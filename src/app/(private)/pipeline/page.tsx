import { BackHome } from "@/components/BackHome";
import { SectionBlock } from "@/components/Metrics";
import { getDashboard } from "@/lib/dashboard";
import { formatUsd } from "@/lib/format";

export default async function PipelinePage() {
  const model = await getDashboard();
  const sf = model.salesforce;
  const connected = sf.state !== "not_connected";
  return (
    <>
      <BackHome />
      <div className="page-head">
        <div>
          <h1>Pipeline</h1>
          <p>{connected ? sf.message : "Salesforce is not connected."}</p>
        </div>
      </div>
      <div className="card-grid">
        <div className="panel">
          <b>Open pipeline</b>
          <p className="headline" style={{ fontSize: 28 }}>{sf.pipelineAmount == null ? "Not connected" : formatUsd(sf.pipelineAmount)}</p>
        </div>
        <div className="panel">
          <b>Wins, year to date</b>
          <p className="headline" style={{ fontSize: 28 }}>{sf.winsAmount == null ? "Not connected" : formatUsd(sf.winsAmount)}</p>
        </div>
        <div className="panel">
          <b>New clients</b>
          <p className="headline" style={{ fontSize: 28 }}>{sf.newClients == null ? "Not connected" : sf.newClients}</p>
        </div>
      </div>
      <SectionBlock title="New sales" items={model.newSales} />
      <SectionBlock title="M&A" items={model.ma} />
    </>
  );
}
