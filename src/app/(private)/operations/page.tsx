import { BackHome } from "@/components/BackHome";
import { SectionBlock } from "@/components/Metrics";
import { getDashboard } from "@/lib/dashboard";

function money(value: number | null): string {
  if (value == null) return "Awaiting data";
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default async function OperationsPage() {
  const model = await getDashboard();
  const orders = model.orders;
  return (
    <>
      <BackHome />
      <div className="page-head">
        <div>
          <h1>Operations</h1>
          <p>CRR and QCR are weekly totals from the scorecard. File-level CRA versus fee economics need an order export.</p>
        </div>
      </div>
      <div className="card-grid">
        <div className="panel">
          <b>CRA files</b>
          <p className="headline" style={{ fontSize: 28 }}>{orders ? orders.cra.files : "Awaiting data"}</p>
          <p className="meta">Share {orders?.craShare == null ? "Awaiting data" : `${orders.craShare.toFixed(1)}%`}</p>
          <p className="meta">Avg fee {money(orders?.cra.avgFee ?? null)} · cost {money(orders?.cra.avgCost ?? null)} · margin {money(orders?.cra.avgMargin ?? null)}</p>
          <p className="meta">Turn {orders?.cra.avgTurn == null ? "Awaiting data" : `${orders.cra.avgTurn.toFixed(1)} BD`} · revision {orders?.cra.revisionRate == null ? "Awaiting data" : `${orders.cra.revisionRate.toFixed(1)}%`}</p>
        </div>
        <div className="panel">
          <b>Fee appraisers</b>
          <p className="headline" style={{ fontSize: 28 }}>{orders ? orders.fee.files : "Awaiting data"}</p>
          <p className="meta">Avg fee {money(orders?.fee.avgFee ?? null)} · cost {money(orders?.fee.avgCost ?? null)} · margin {money(orders?.fee.avgMargin ?? null)}</p>
          <p className="meta">Turn {orders?.fee.avgTurn == null ? "Awaiting data" : `${orders.fee.avgTurn.toFixed(1)} BD`} · revision {orders?.fee.revisionRate == null ? "Awaiting data" : `${orders.fee.revisionRate.toFixed(1)}%`}</p>
        </div>
        <div className="panel">
          <b>Unclassified files</b>
          <p className="headline" style={{ fontSize: 28 }}>{orders ? orders.unknownFiles : "Awaiting data"}</p>
          <p className="footer-meta">Updated {model.orderAsOf || "Awaiting data"} · ValuTrac order upload</p>
        </div>
      </div>
      <SectionBlock title="Scorecard operations" items={model.operations} />
    </>
  );
}
