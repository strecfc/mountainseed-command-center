import { formatIsoDate } from "../format";

export type MoneyCell = {
  actual: number | null;
  budget: number | null;
  variance: number | null;
  variancePct: number | null;
};

export type BudgetSnapshot = {
  periodEnd: string;
  filename: string;
  email: string;
  september: Record<string, MoneyCell>;
  q3: Record<string, MoneyCell>;
  ytd: Record<string, MoneyCell>;
  fullYear: Record<string, MoneyCell>;
  quarters: Record<"q1" | "q2" | "q3", Record<string, MoneyCell>>;
  monthly: { month: string; sheet: string; lines: Record<string, MoneyCell> }[];
  notes: string[];
};

const REQUIRED = ["total_revenue", "gross_profit", "gross_margin", "ebitda", "ebitda_margin"] as const;

function cell(value: unknown): MoneyCell {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const num = (key: string) => {
    const raw = record[key];
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  };
  return { actual: num("actual"), budget: num("budget"), variance: num("variance"), variancePct: num("variance_pct") };
}

function block(value: unknown): Record<string, MoneyCell> {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const out: Record<string, MoneyCell> = {};
  for (const [key, item] of Object.entries(record)) out[key] = cell(item);
  return out;
}

export function parseBudgetSnapshot(raw: unknown): BudgetSnapshot {
  if (!raw || typeof raw !== "object") throw new Error("Budget vs actual JSON must be an object.");
  const body = raw as Record<string, unknown>;
  const periodEnd = String(body.period_end || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(periodEnd)) throw new Error("period_end must be YYYY-MM-DD.");
  const september = block(body.september);
  const ytd = block(body.ytd);
  for (const key of REQUIRED) {
    if (!september[key] || !ytd[key]) throw new Error(`Missing ${key} on september or ytd.`);
  }
  const quartersRaw = body.quarters && typeof body.quarters === "object" ? (body.quarters as Record<string, unknown>) : {};
  const monthlyRaw = Array.isArray(body.monthly) ? body.monthly : [];
  const source = body.source && typeof body.source === "object" ? (body.source as Record<string, unknown>) : {};
  return {
    periodEnd,
    filename: String(source.file || "budget-vs-actual.json"),
    email: String(source.email || ""),
    september,
    q3: block(body.q3),
    ytd,
    fullYear: block(body.full_year_budget),
    quarters: {
      q1: block(quartersRaw.q1),
      q2: block(quartersRaw.q2),
      q3: block(quartersRaw.q3),
    },
    monthly: monthlyRaw.map((item) => {
      const row = item as Record<string, unknown>;
      return {
        month: String(row.month || ""),
        sheet: String(row.sheet || ""),
        lines: block(row.lines),
      };
    }),
    notes: Array.isArray(body.notes) ? body.notes.map((note) => String(note)) : [],
  };
}

export function formatUsdCents(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function marginPercent(decimal: number, digits: number): string {
  return `${(decimal * 100).toFixed(digits)}%`;
}

export function marginPoints(decimalVariance: number): string {
  const points = decimalVariance * 100;
  const sign = points > 0 ? "+" : "";
  return `${sign}${points.toFixed(2)} pp`;
}

function signedMoney(value: number): string {
  return formatUsdCents(value);
}

function signedPercent(decimal: number): string {
  const points = decimal * 100;
  const sign = points > 0 ? "+" : "";
  return `${sign}${points.toFixed(1)}%`;
}

export type HeadlineRow = {
  label: string;
  kind: "money" | "margin";
  septemberActual: string;
  septemberBudget: string;
  septemberVariance: string;
  ytdActual: string;
  ytdBudget: string;
  ytdVariance: string;
  fyBudget: string;
};

export type RevenueRow = {
  label: string;
  septemberActual: string;
  septemberBudget: string;
  septemberVariance: string;
  ytdActual: string;
  ytdBudget: string;
  ytdVariance: string;
};

export type TrendPoint = {
  label: string;
  actual: number | null;
  budget: number | null;
  stale: boolean;
};

export type FinanceBoard = {
  periodEnd: string;
  periodLabel: string;
  source: string;
  updated: string;
  rows: HeadlineRow[];
  revenueLines: RevenueRow[];
  revenueTrend: TrendPoint[];
  ebitdaTrend: TrendPoint[];
  fyNote: string;
  ytdBudgetNote: string;
  q2Note: string;
  ebitdaLabel: string;
  scoreboard: {
    ytdMargin: string;
    ytdBudget: string;
    septemberMargin: string;
    septemberBudget: string;
    q3Margin: string;
    q3Budget: string;
    ytdMarginNumber: number;
    ytdBudgetNumber: number;
    septemberMarginNumber: number;
    septemberBudgetNumber: number;
    q3MarginNumber: number;
    q3BudgetNumber: number;
    ytdGrossMargin: string;
    ytdGrossMarginBudget: string;
    ytdEbitdaVariance: string;
  };
};

const REVENUE_LINES: { key: string; label: string }[] = [
  { key: "marketplace", label: "Marketplace" },
  { key: "mp_appraisal", label: "MP Appraisal Revenue" },
  { key: "other_marketplace", label: "Other MarketPlace Revenue" },
  { key: "commercial_evaluations", label: "Commercial evaluations" },
  { key: "residential_evaluations", label: "Residential evaluations" },
  { key: "environmentals", label: "Environmentals" },
  { key: "compliance_screen", label: "Compliance screen" },
  { key: "site_inspections", label: "Site inspections" },
  { key: "avm", label: "AVM" },
  { key: "other_revenue_mp", label: "Other revenue (MarketPlace)" },
  { key: "augur", label: "Augur" },
  { key: "market_data_reports", label: "Market Data Reports" },
  { key: "mountainseed_analytics", label: "MountainSeed Analytics" },
  { key: "nbp", label: "NBP" },
  { key: "capital_markets", label: "Capital Markets" },
  { key: "sale_leaseback_mres", label: "Sale-leaseback (MRES)" },
  { key: "fund_slb_acquisition_carried_interest", label: "Fund SLB carried interest" },
  { key: "fund_management_fees", label: "Fund management fees" },
  { key: "quaint_oak", label: "Quaint Oak" },
  { key: "total_revenue", label: "Total revenue" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthLabel(isoMonth: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(isoMonth);
  if (!match) return isoMonth;
  return MONTHS[Number(match[2]) - 1] || isoMonth;
}

function moneyText(value: number | null): string {
  return value == null ? "—" : formatUsdCents(value);
}

function varianceText(item: MoneyCell | undefined, kind: "money" | "margin"): string {
  if (!item || item.variance == null) return "—";
  if (kind === "margin") return marginPoints(item.variance);
  const pct = item.variancePct == null ? "" : ` (${signedPercent(item.variancePct)})`;
  return `${signedMoney(item.variance)}${pct}`;
}

function headline(snapshot: BudgetSnapshot, key: string, label: string, kind: "money" | "margin"): HeadlineRow {
  const show = (item: MoneyCell | undefined, field: "actual" | "budget") => {
    const value = item?.[field];
    if (value == null) return "—";
    return kind === "margin" ? marginPercent(value, 2) : formatUsdCents(value);
  };
  return {
    label,
    kind,
    septemberActual: show(snapshot.september[key], "actual"),
    septemberBudget: show(snapshot.september[key], "budget"),
    septemberVariance: varianceText(snapshot.september[key], kind),
    ytdActual: show(snapshot.ytd[key], "actual"),
    ytdBudget: show(snapshot.ytd[key], "budget"),
    ytdVariance: varianceText(snapshot.ytd[key], kind),
    fyBudget: show(snapshot.fullYear[key], "budget"),
  };
}

function hasAmount(item: MoneyCell | undefined): boolean {
  return Boolean(item && (item.actual != null || item.budget != null));
}

export function presentBudget(snapshot: BudgetSnapshot, receivedOn: string, sourceLabel: string): FinanceBoard {
  const ytdMargin = snapshot.ytd.ebitda_margin;
  const sepMargin = snapshot.september.ebitda_margin;
  const q3Margin = snapshot.q3.ebitda_margin;
  const ytdGross = snapshot.ytd.gross_margin;
  const q2 = snapshot.quarters.q2;
  const q2Opex = q2.total_operating_expenses?.actual;
  const q2Ebitda = q2.ebitda?.actual;
  return {
    periodEnd: snapshot.periodEnd,
    periodLabel: formatIsoDate(snapshot.periodEnd),
    source: sourceLabel,
    updated: formatIsoDate(receivedOn),
    ebitdaLabel: "Reported EBITDA",
    rows: [
      headline(snapshot, "total_revenue", "Total revenue", "money"),
      headline(snapshot, "gross_profit", "Gross profit", "money"),
      headline(snapshot, "gross_margin", "Gross margin", "margin"),
      headline(snapshot, "ebitda", "Reported EBITDA", "money"),
      headline(snapshot, "ebitda_margin", "Reported EBITDA margin", "margin"),
    ],
    revenueLines: REVENUE_LINES.filter((line) => hasAmount(snapshot.september[line.key]) || hasAmount(snapshot.ytd[line.key])).map(
      (line) => ({
        label: line.label,
        septemberActual: moneyText(snapshot.september[line.key]?.actual ?? null),
        septemberBudget: moneyText(snapshot.september[line.key]?.budget ?? null),
        septemberVariance: varianceText(snapshot.september[line.key], "money"),
        ytdActual: moneyText(snapshot.ytd[line.key]?.actual ?? null),
        ytdBudget: moneyText(snapshot.ytd[line.key]?.budget ?? null),
        ytdVariance: varianceText(snapshot.ytd[line.key], "money"),
      }),
    ),
    revenueTrend: snapshot.monthly.map((month) => ({
      label: monthLabel(month.month),
      actual: month.lines.total_revenue?.actual ?? null,
      budget: month.lines.total_revenue?.budget ?? null,
      stale: false,
    })),
    ebitdaTrend: snapshot.monthly.map((month) => ({
      label: monthLabel(month.month),
      actual: month.lines.ebitda?.actual ?? null,
      budget: month.lines.ebitda?.budget ?? null,
      stale: month.sheet === "Q2 2026",
    })),
    fyNote: "Full-year figures are the P&L budget column only. There is no full-year actual yet.",
    ytdBudgetNote: "YTD budget is Q1 + Q2 + Q3 on the P&L. It is not the full-year budget.",
    q2Note: `April–June monthly operating expense and reported EBITDA come from the Q2 tab and do not match the September P&L. Q2 on the P&L is operating expense ${q2Opex == null ? "—" : formatUsdCents(q2Opex)} and reported EBITDA ${q2Ebitda == null ? "—" : formatUsdCents(q2Ebitda)}. The chart plots the monthly tab and marks April–June.`,
    scoreboard: {
      ytdMargin: ytdMargin.actual == null ? "Awaiting data" : marginPercent(ytdMargin.actual, 1),
      ytdBudget: ytdMargin.budget == null ? "Awaiting data" : marginPercent(ytdMargin.budget, 1),
      septemberMargin: sepMargin.actual == null ? "Awaiting data" : marginPercent(sepMargin.actual, 1),
      septemberBudget: sepMargin.budget == null ? "Awaiting data" : marginPercent(sepMargin.budget, 1),
      q3Margin: q3Margin?.actual == null ? "Awaiting data" : marginPercent(q3Margin.actual, 1),
      q3Budget: q3Margin?.budget == null ? "Awaiting data" : marginPercent(q3Margin.budget, 1),
      ytdMarginNumber: (ytdMargin.actual ?? 0) * 100,
      ytdBudgetNumber: (ytdMargin.budget ?? 0) * 100,
      septemberMarginNumber: (sepMargin.actual ?? 0) * 100,
      septemberBudgetNumber: (sepMargin.budget ?? 0) * 100,
      q3MarginNumber: (q3Margin?.actual ?? 0) * 100,
      q3BudgetNumber: (q3Margin?.budget ?? 0) * 100,
      ytdGrossMargin: ytdGross?.actual == null ? "Awaiting data" : marginPercent(ytdGross.actual, 1),
      ytdGrossMarginBudget: ytdGross?.budget == null ? "Awaiting data" : marginPercent(ytdGross.budget, 1),
      ytdEbitdaVariance: snapshot.ytd.ebitda?.variance == null ? "Awaiting data" : formatUsdCents(snapshot.ytd.ebitda.variance),
    },
  };
}

export const BVA_SOURCE = "Max DiPlotti BvA, received 2026-10-16";
export const BVA_RECEIVED_ON = "2026-10-16";

const MONTH_INDEX: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

export function describeBudgetUpload(raw: unknown, fallbackDate = new Date().toISOString().slice(0, 10)): {
  source: string;
  receivedOn: string;
} {
  const email =
    raw && typeof raw === "object" && "source" in raw && raw.source && typeof raw.source === "object"
      ? String((raw.source as { email?: string }).email || "")
      : "";
  const match = email.match(/\(([A-Za-z]+)\s+(\d{1,2})\s+(\d{4})\)/);
  const month = match ? MONTH_INDEX[match[1].slice(0, 3).toLowerCase()] : undefined;
  if (match && month) {
    const receivedOn = `${match[3]}-${month}-${match[2].padStart(2, "0")}`;
    return { receivedOn, source: `Max DiPlotti BvA, received ${receivedOn}` };
  }
  return { receivedOn: fallbackDate, source: `Budget vs actual upload, received ${fallbackDate}` };
}
