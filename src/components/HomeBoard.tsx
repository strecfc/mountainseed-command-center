import Link from "next/link";
import type { DashboardModel } from "@/lib/dashboard";
import type { Status } from "@/lib/status";
import { rate } from "@/lib/status";

function money(value: string): number | null {
  const n = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function compact(value: string): string {
  const n = money(value);
  if (n == null) return value;
  const sign = n < 0 ? "-" : "";
  const millions = Math.abs(n) / 1_000_000;
  if (millions >= 10) return `${sign}$${millions.toFixed(1)}M`;
  if (millions >= 1) return `${sign}$${millions.toFixed(2)}M`;
  return value;
}

function word(status: Status): string {
  if (status === "green") return "On track";
  if (status === "yellow") return "Amber";
  if (status === "red") return "Off track";
  return "Not connected";
}

export function HomeBoard({ model }: { model: DashboardModel }) {
  const revenue = model.budget?.rows.find((row) => row.label === "Total revenue");
  const ytdActual = revenue ? money(revenue.ytdActual) : null;
  const ytdBudget = revenue ? money(revenue.ytdBudget) : null;
  const revenueStatus: Status = revenue && ytdActual != null && ytdBudget != null ? rate(ytdActual, ytdBudget, "higher") : "none";
  const margin = model.heroes.find((hero) => hero.id === "gross-margin");
  const ebitda = model.heroes.find((hero) => hero.id === "ebitda");
  const salesforce = model.salesforce;
  const connected = salesforce.state !== "not_connected" && salesforce.state !== "awaiting";
  const off = model.counts.offTrack;
  const scoreStatus: Status = off > 0 ? "red" : model.counts.watch > 0 ? "yellow" : model.counts.onTrack > 0 ? "green" : "none";

  const tiles = [
    {
      href: "/finance#revenue",
      kicker: "Revenue vs plan",
      value: revenue ? compact(revenue.ytdActual) : "Awaiting data",
      detail: revenue
        ? `YTD vs ${compact(revenue.ytdBudget)} budget`
        : "Month and year to date",
      extra: revenue ? `Sep ${compact(revenue.septemberActual)} vs ${compact(revenue.septemberBudget)}` : "Open finance",
      status: revenueStatus,
    },
    {
      href: "/finance#margin",
      kicker: "Gross margin",
      value: margin?.headline || "Awaiting data",
      detail: margin?.goal ? margin.goal.replace("Blended goal ", "vs ").replace(/%$/, "% goal") : "vs plan",
      extra: "Week ending " + model.featuredLabel,
      status: margin?.overall || "none",
    },
    {
      href: "/finance#ebitda",
      kicker: "EBITDA margin",
      value: ebitda?.headline || "Awaiting data",
      detail: ebitda?.goal?.startsWith("YTD budget ") ? `vs ${ebitda.goal.slice("YTD budget ".length)} budget` : "vs budget",
      extra: ebitda?.goal?.startsWith("YTD") ? "Reported · year to date" : "Reported EBITDA",
      status: ebitda?.overall || "none",
    },
    {
      href: "/pipeline",
      kicker: "Pipeline",
      value: connected && salesforce.pipelineAmount != null ? compactUsd(salesforce.pipelineAmount) : "Not connected",
      detail: "Salesforce",
      extra: connected ? salesforce.message : "Daily pull when credentials are set",
      status: "none" as Status,
    },
    {
      href: "/goals",
      kicker: "Scorecard",
      value: off > 0 ? String(off) : String(model.counts.onTrack),
      detail: off > 0 ? "off track" : "on track",
      extra: `${model.counts.onTrack} on track · ${model.counts.watch} amber`,
      status: scoreStatus,
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
          <span className="status" data-status={tile.status}>{word(tile.status)}</span>
        </Link>
      ))}
    </div>
  );
}

function compactUsd(value: number): string {
  const sign = value < 0 ? "-" : "";
  const millions = Math.abs(value) / 1_000_000;
  if (millions >= 10) return `${sign}$${millions.toFixed(1)}M`;
  if (millions >= 1) return `${sign}$${millions.toFixed(2)}M`;
  return `${sign}$${Math.round(Math.abs(value)).toLocaleString("en-US")}`;
}
