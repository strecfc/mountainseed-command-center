import { BackHome } from "@/components/BackHome";
import { ReadoutList } from "@/components/Metrics";
import { formatChurnDate, loadChurnedClients } from "@/lib/churned-clients";
import { getDashboard } from "@/lib/dashboard";
import { LABELS } from "@/lib/labels";

export default async function ChurnPage() {
  const model = await getDashboard();
  const churned = await loadChurnedClients();
  const items = model.defense.filter((item) => item.label === LABELS.logoChurn || item.label === LABELS.yoyRetention);
  return (
    <>
      <BackHome />
      <div className="page-head">
        <div>
          <h1>Logo churn</h1>
          <p>
            {churned.live
              ? `${churned.count} depository clients from the latest Salesforce pull.`
              : `${churned.count} depository clients. 35 of 388 is 9.02%, the leadership Scorecard figure for the week ending ${model.featuredLabel}.`}
          </p>
        </div>
      </div>
      <ReadoutList items={items} />
      <section className="section">
        <h2 className="section-title">Churned clients ({churned.count})</h2>
        <p className="lede">{churned.sourceNote}</p>
        <div className="panel scroll">
          <table>
            <thead>
              <tr>
                <th>Client</th>
                <th>Churn date</th>
                <th>Last order</th>
                <th>Days since last order</th>
                <th>Closed-lost reason</th>
                <th>Owner</th>
              </tr>
            </thead>
            <tbody>
              {churned.clients.map((client) => (
                <tr key={`${client.name}-${client.closedOn}`}>
                  <td>{client.name}</td>
                  <td>{formatChurnDate(client.closedOn)}</td>
                  <td>{formatChurnDate(client.lastOrderOn)}</td>
                  <td className="num">{client.daysSinceLastOrder ?? "—"}</td>
                  <td>{client.reason || "—"}</td>
                  <td>{client.owner || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="panel">
        <p>True net dollar retention is awaiting revenue by client. The 89% figure above is the scorecard’s year-over-year net retention, not a client-level NDR.</p>
      </div>
    </>
  );
}
