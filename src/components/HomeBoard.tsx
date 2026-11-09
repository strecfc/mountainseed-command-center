import Link from "next/link";
import type { DashboardModel, Readout } from "@/lib/dashboard";
import { LABELS } from "@/lib/labels";
import { rate, type Status } from "@/lib/status";

function parseNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const n = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function compact(value: string): string {
  const n = parseNumber(value);
  if (n == null) return value;
  const sign = n < 0 ? "-" : "";
  const millions = Math.abs(n) / 1_000_000;
  if (millions >= 10) return `${sign}$${millions.toFixed(1)}M`;
  if (millions >= 1) return `${sign}$${millions.toFixed(2)}M`;
  return value;
}

function thousands(readout: Readout | undefined): string {
  if (!readout || readout.headline === "Awaiting data") return "Awaiting data";
  return readout.label.includes("Thousands") && readout.headline.startsWith("$")
    ? `${readout.headline}k`
    : readout.headline;
}

function word(status: Status): string {
  if (status === "green") return "On track";
  if (status === "yellow") return "Amber";
  if (status === "red") return "Off track";
  return "Awaiting data";
}

function tracked(model: DashboardModel): Readout[] {
  return [...model.newSales, ...model.upsell, ...model.ma, ...model.defense, ...model.operations];
}

function findReadout(model: DashboardModel, label: string): Readout | undefined {
  return tracked(model).find((item) => item.label === label);
}

function miss(readout: Readout): number {
  const window = readout.windows.find((item) => item.status === "red") || readout.windows[0];
  const value = parseNumber(window?.value);
  const goal = parseNumber(window?.goal);
  if (value == null || goal == null || goal === 0) return 0;
  return Math.abs(value / goal - 1);
}

function truncate(label: string): string {
  return label.length > 46 ? `${label.slice(0, 45)}…` : label;
}

export function offTrackReadouts(model: DashboardModel): Readout[] {
  return tracked(model)
    .filter((item) => item.overall === "red")
    .sort((a, b) => miss(b) - miss(a));
}

export function HomeBoard({ model }: { model: DashboardModel }) {
  const revenue = model.budget?.rows.find((row) => row.label === "Total revenue");
  const churn = findReadout(model, LABELS.logoChurn);
  const retention = findReadout(model, LABELS.yoyRetention);
  const newSales = findReadout(model, LABELS.newEl);
  const realization = findReadout(model, LABELS.evaluation);
  const margin = model.heroes.find((hero) => hero.id === "gross-margin");
  const ebitda = model.heroes.find((hero) => hero.id === "ebitda");
  const off = offTrackReadouts(model);
  const scoreStatus: Status = off.length > 0 ? "red" : model.counts.watch > 0 ? "yellow" : model.counts.onTrack > 0 ? "green" : "none";
  const retentionWeek = retention?.windows.find((window) => window.label === "This week");
  const churnGoal = churn?.headlineGoal || "10%";

  const tiles = [
    {
      href: "/churn",
      kicker: "Logo churn",
      value: churn?.headline || "Awaiting data",
      detail: churn ? `vs ${churnGoal} ceiling` : "Awaiting data: leadership Scorecard",
      extra: retentionWeek && retentionWeek.value !== "Awaiting data"
        ? `YoY net retention ${retentionWeek.value} vs ${retentionWeek.goal || "100%"} goal`
        : "Awaiting data: Year-over-Year Net Retention %",
      period: `Week ending ${model.featuredLabel} · Leadership Scorecard`,
      status: churn?.overall || "none",
      names: [] as string[],
    },
    {
      href: "/sales",
      kicker: "New sales",
      value: thousands(newSales),
      detail: newSales?.headlineGoal ? `vs ${newSales.headlineGoal} QTD goal` : "vs plan",
      extra: realization && realization.headline !== "Awaiting data"
        ? `Evaluation realization ${realization.headline} vs ${realization.headlineGoal || "100%"}`
        : "Awaiting data: Salesforce won upsell",
      period: "New EL value · MarketPlace Sales Scorecard · through 18 Oct 2026",
      status: newSales?.overall || "none",
      names: [],
    },
    {
      href: "/finance#revenue",
      kicker: "Revenue vs plan",
      value: revenue ? compact(revenue.ytdActual) : "Awaiting data",
      detail: revenue ? `YTD vs ${compact(revenue.ytdBudget)} budget` : "Awaiting data: September BvA",
      extra: revenue ? `Sep ${compact(revenue.septemberActual)} vs ${compact(revenue.septemberBudget)}` : "Month and year to date",
      period: revenue ? "September and YTD through 30 Sep 2026 · BvA" : "Awaiting data: monthly budget vs actual",
      status: revenue ? rate(parseNumber(revenue.ytdActual), parseNumber(revenue.ytdBudget), "higher") : "none",
      names: [],
    },
    {
      href: "/finance#margin",
      kicker: "Gross margin",
      value: margin?.headline || "Awaiting data",
      detail: margin?.goal?.includes("%") ? margin.goal.replace("Blended goal ", "vs ").replace(/%$/, "% goal") : "vs plan",
      extra: "Blended, leadership Scorecard",
      period: `Week ending ${model.featuredLabel}`,
      status: margin?.overall || "none",
      names: [],
    },
    {
      href: "/finance#ebitda",
      kicker: "EBITDA margin",
      value: ebitda?.headline || "Awaiting data",
      detail: ebitda?.goal?.startsWith("YTD budget ") ? `vs ${ebitda.goal.slice("YTD budget ".length)} YTD budget` : "vs budget",
      extra: "Reported EBITDA, not adjusted",
      period: "YTD through 30 Sep 2026 · BvA",
      status: ebitda?.overall || "none",
      names: [],
    },
    {
      href: "/goals",
      kicker: "Scorecard goals",
      value: `${off.length} off track`,
      detail: `${model.counts.watch} amber · ${model.counts.onTrack} on track`,
      extra: "Top off-track goals",
      period: `Week ending ${model.featuredLabel}`,
      status: scoreStatus,
      names: off.slice(0, 3).map((item) => truncate(item.label)),
    },
  ];

  return (
    <div className="home-grid">
      {tiles.map((tile) => (
        <Link key={tile.href} href={tile.href} className="home-tile" data-status={tile.status}>
          <span className="home-kicker">{tile.kicker}</span>
          <span className="home-value">{tile.value}</span>
          <span className="home-detail">{tile.detail}</span>
          <span className="home-extra">{tile.extra}</span>
          {tile.names.length ? (
            <ul className="home-names">
              {tile.names.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          ) : null}
          <span className="home-period">{tile.period}</span>
          <span className="status" data-status={tile.status}>{word(tile.status)}</span>
        </Link>
      ))}
    </div>
  );
}
