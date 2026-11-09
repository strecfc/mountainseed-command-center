import { SectionBlock } from "@/components/Metrics";
import { getDashboard } from "@/lib/dashboard";
import { formatUsd } from "@/lib/format";

export default async function DefensePage() {
  const model = await getDashboard();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Defense</h1>
          <p>Logo churn, net retention, and quiet clients. Tiered risk and order-volume warnings stay empty until the source exists.</p>
        </div>
      </div>
      <SectionBlock title="Churn" items={model.defense} />
      <section className="section">
        <h2 className="section-title">At-risk accounts</h2>
        <div className="panel scroll">
          {model.atRisk.length ? (
            <table>
              <thead><tr><th>Client</th><th>Tier</th><th>Reason</th><th>Annual value</th><th>Source</th></tr></thead>
              <tbody>
                {model.atRisk.map((row) => (
                  <tr key={row.clientName}>
                    <td>{row.clientName}</td>
                    <td>{row.tier || "Awaiting data"}</td>
                    <td>{row.reason || "Awaiting data"}</td>
                    <td>{row.annualValue == null ? "Awaiting data" : formatUsd(row.annualValue)}</td>
                    <td>{row.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>Awaiting data. Salesforce case churn risk will land here after credentials are connected, or an admin can push rows through the ingest API.</p>
          )}
          <p className="footer-meta">
            Salesforce open churn-risk cases: {model.salesforce.churnCases == null ? "Awaiting data" : model.salesforce.churnCases} · {model.salesforce.state === "not_connected" ? "Not connected" : model.salesforce.message}
          </p>
        </div>
      </section>
      <section className="section">
        <h2 className="section-title">Early-warning order drop</h2>
        <div className="panel">
          {model.orders ? (
            model.orders.earlyWarnings.length ? (
              <ul className="lines">
                {model.orders.earlyWarnings.map((item) => (
                  <li key={item.client}>
                    <span>{item.client}</span>
                    <strong>{item.dropPct.toFixed(0)}% below baseline</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No client in the latest order file is more than 20% below its prior 90-day weekly baseline.</p>
            )
          ) : (
            <p>Awaiting data. Upload a ValuTrac export to compare each client's recent week with its prior 90 days.</p>
          )}
          <p className="footer-meta">Updated {model.orderAsOf || "Awaiting data"} · ValuTrac order upload</p>
        </div>
      </section>
    </>
  );
}
