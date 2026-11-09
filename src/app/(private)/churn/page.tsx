import { BackHome } from "@/components/BackHome";
import { ReadoutList } from "@/components/Metrics";
import { getDashboard } from "@/lib/dashboard";
import { LABELS } from "@/lib/labels";

export default async function ChurnPage() {
  const model = await getDashboard();
  const items = model.defense.filter((item) => item.label === LABELS.logoChurn || item.label === LABELS.yoyRetention);
  return (
    <>
      <BackHome />
      <div className="page-head">
        <div>
          <h1>Logo churn</h1>
          <p>
            Logo churn and year-over-year net retention are the leadership Scorecard figures for the week ending{" "}
            {model.featuredLabel}. Client-level net dollar retention is not on the scorecard or the September budget,
            because neither file has revenue by client.
          </p>
        </div>
      </div>
      <ReadoutList items={items} />
      <div className="panel">
        <p>
          Awaiting data: net dollar retention computed from revenue by client. Salesforce is not queried for lost
          accounts, because this app has no Account churn field in its schema or seed.
        </p>
      </div>
      <h2 className="section-title">Other defense lines</h2>
      <ReadoutList items={model.defense.filter((item) => !items.includes(item))} />
    </>
  );
}
