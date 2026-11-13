import Link from "next/link";
import { BackHome } from "@/components/BackHome";
import { offTrackReadouts } from "@/components/HomeBoard";
import { SectionBlock } from "@/components/Metrics";
import { getDashboard } from "@/lib/dashboard";

const MORE = [
  ["/growth", "Growth"],
  ["/defense", "Defense"],
  ["/operations", "Operations"],
  ["/sections/augur", "Augur"],
  ["/sections/sales-leaseback", "Sales leaseback"],
  ["/sections/nbp", "NBP"],
  ["/notes", "Notes"],
];

export default async function GoalsPage() {
  const model = await getDashboard();
  return (
    <>
      <BackHome />
      <div className="page-head">
        <div>
          <h1>Scorecard</h1>
          <p>
            Week ending {model.featuredLabel}. {model.counts.offTrack} off track, {model.counts.watch} amber,{" "}
            {model.counts.onTrack} on track.
          </p>
        </div>
      </div>
      <section className="section">
        <h2 className="section-title">Off track</h2>
        <div className="panel">
          {offTrackReadouts(model).length ? (
            <ul className="lines">
              {offTrackReadouts(model).map((item) => (
                <li key={item.label}>
                  <span>{item.label}</span>
                  <strong>
                    {item.headline}
                    {item.headlineGoal ? ` vs ${item.headlineGoal}` : ""}
                  </strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>No scorecard goals are off track.</p>
          )}
        </div>
      </section>
      <SectionBlock title="New sales" items={model.newSales} />
      <SectionBlock title="Upsell" items={model.upsell} />
      <SectionBlock title="M&A" items={model.ma} />
      <SectionBlock title="Churn" items={model.defense} />
      <SectionBlock title="Operations" items={model.operations} />
      <section className="section">
        <h2 className="section-title">More</h2>
        <p className="more-links">
          {MORE.map(([href, label]) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
        </p>
      </section>
    </>
  );
}
