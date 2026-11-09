import { sql } from "./db";
import {
  average,
  detectKind,
  formatAverage,
  formatIsoDate,
  formatNumber,
  formatTimestamp,
  formatUsd,
  type NumberKind,
} from "./format";
import { LABELS } from "./labels";
import type { OrderLine, OrderSummary } from "./importers/orders";
import { summarizeOrders } from "./importers/orders";
import { parseBudgetSnapshot, presentBudget, type FinanceBoard } from "./importers/bva";
import { salesforceView, type SalesforceView } from "./salesforce";
import { directionFor, rate, worstStatus, type Direction, type Status } from "./status";

export type WindowView = {
  label: string;
  value: string;
  goal: string | null;
  status: Status;
};

export type Readout = {
  label: string;
  overall: Status;
  headline: string;
  headlineGoal: string | null;
  windows: WindowView[];
  history: { week: string; value: string }[];
  updated: string | null;
  source: string;
  note?: string;
};

export type Hero = {
  id: string;
  kicker: string;
  title: string;
  overall: Status;
  headline: string;
  caption: string;
  goal: string;
  windows: WindowView[];
  lines: { label: string; value: string }[];
  updated: string | null;
  source: string;
};

type Obs = {
  label: string;
  section: string;
  category: string;
  direction: Direction;
  periodStart: string;
  periodType: string;
  valueRaw: string | null;
  valueNumeric: number | null;
  totalRaw: string | null;
  totalNumeric: number | null;
  avgRaw: string | null;
  avgNumeric: number | null;
  goalRaw: string | null;
  goalNumeric: number | null;
  wkRaw: string | null;
  wkNumeric: number | null;
  source: string;
  sourceDetail: string | null;
  updatedAt: string;
};

type Monthly = {
  period: string;
  revenueActual: number | null;
  revenueBudget: number | null;
  grossMarginActual: number | null;
  grossMarginAppraisal: number | null;
  grossMarginNonAppraisal: number | null;
  ebitdaActual: number | null;
  ebitdaBudget: number | null;
  ebitdaMarginActual: number | null;
  expensesActual: number | null;
  expensesBudget: number | null;
  filename: string | null;
  source: string;
  updatedAt: string;
};

type Deal = {
  opportunityName: string;
  amount: number | null;
  age: number | null;
  closeDate: string | null;
  expectedMonthlyAppraisals: number | null;
  weeklyGoal: number | null;
  actualUploads: number | null;
  diff: number | null;
};

export type DashboardModel = {
  featuredWeek: string | null;
  featuredLabel: string;
  salesforce: SalesforceView;
  heroes: Hero[];
  newSales: Readout[];
  upsell: Readout[];
  ma: Readout[];
  defense: Readout[];
  operations: Readout[];
  counts: { onTrack: number; watch: number; offTrack: number; awaiting: number };
  note: { weekEnding: string; whatChanged: string; owner: string; nextStep: string; updated: string | null } | null;
  orders: OrderSummary | null;
  orderAsOf: string | null;
  atRisk: { clientName: string; tier: string | null; reason: string | null; annualValue: number | null; source: string }[];
  augur: {
    asOf: string | null;
    weekOf: string | null;
    uploadsTotal: number | null;
    weeklyGoalTotal: number | null;
    annualVolumePreOctober: number | null;
    deals: Deal[];
  } | null;
  monthly: Monthly | null;
  targets: Record<string, number | null>;
};

function asIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function asTime(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

function num(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const SOURCE_NAMES: Record<string, string> = {
  "leadership-scorecard": "Leadership Scorecard",
  "marketplace-sales-scorecard": "MarketPlace Sales Scorecard",
  budget: "Monthly budget vs actual",
  salesforce: "Salesforce",
  orders: "ValuTrac order upload",
  manual: "Manual entry",
  ingest: "Ingest API",
};

function sourceLabel(row: Obs | undefined): string {
  if (!row) return "Awaiting data";
  return row.sourceDetail || SOURCE_NAMES[row.source] || row.source;
}

export async function loadObservations(): Promise<{
  featuredWeek: string | null;
  byLabel: Map<string, Obs[]>;
  catalog: { label: string; section: string; category: string }[];
}> {
  const meta = await sql<{ value: string }>("SELECT value FROM app_meta WHERE key = 'latest_scorecard_week'");
  const rows = await sql<Record<string, unknown>>(
    `SELECT d.label, d.section, d.category, d.direction, o.period_start, o.period_type,
            o.value_raw, o.value_numeric, o.total_qtd_raw, o.total_qtd_numeric,
            o.avg_qtd_raw, o.avg_qtd_numeric, o.qtd_goal_raw, o.qtd_goal_numeric,
            o.wk_goal_raw, o.wk_goal_numeric, o.source, o.source_detail, o.updated_at
     FROM observations o JOIN metric_definitions d ON d.key = o.metric_key`,
  );
  const byLabel = new Map<string, Obs[]>();
  for (const row of rows) {
    const obs: Obs = {
      label: String(row.label),
      section: String(row.section),
      category: String(row.category),
      direction: row.direction === "lower" ? "lower" : "higher",
      periodStart: asIso(row.period_start),
      periodType: String(row.period_type),
      valueRaw: row.value_raw == null ? null : String(row.value_raw),
      valueNumeric: num(row.value_numeric),
      totalRaw: row.total_qtd_raw == null ? null : String(row.total_qtd_raw),
      totalNumeric: num(row.total_qtd_numeric),
      avgRaw: row.avg_qtd_raw == null ? null : String(row.avg_qtd_raw),
      avgNumeric: num(row.avg_qtd_numeric),
      goalRaw: row.qtd_goal_raw == null ? null : String(row.qtd_goal_raw),
      goalNumeric: num(row.qtd_goal_numeric),
      wkRaw: row.wk_goal_raw == null ? null : String(row.wk_goal_raw),
      wkNumeric: num(row.wk_goal_numeric),
      source: String(row.source),
      sourceDetail: row.source_detail == null ? null : String(row.source_detail),
      updatedAt: asTime(row.updated_at),
    };
    const list = byLabel.get(obs.label) || [];
    list.push(obs);
    byLabel.set(obs.label, list);
  }
  const defs = await sql<{ label: string; section: string; category: string }>(
    "SELECT label, section, category FROM metric_definitions ORDER BY section, sort_order, label",
  );
  return { featuredWeek: meta[0]?.value ?? null, byLabel, catalog: defs };
}

function kindOf(rows: Obs[]): NumberKind {
  const sample = rows.find((row) => row.valueRaw)?.valueRaw || rows.find((row) => row.totalRaw)?.totalRaw || rows.find((row) => row.avgRaw)?.avgRaw;
  return detectKind(sample);
}

function weekCalendar(byLabel: Map<string, Obs[]>, featuredWeek: string | null): { trail: string[]; history: string[] } {
  const dates = new Set<string>();
  for (const rows of byLabel.values()) {
    for (const row of rows) {
      if (row.periodType === "week") dates.add(row.periodStart);
    }
  }
  const history = [...dates].sort((a, b) => b.localeCompare(a));
  const anchor = featuredWeek || history[0] || null;
  const trail = history.filter((date) => (anchor ? date <= anchor : true)).slice(0, 4);
  return { trail, history: history.slice(0, 5) };
}

export function buildReadout(
  byLabel: Map<string, Obs[]>,
  featuredWeek: string | null,
  label: string,
  trailDates: string[],
  historyDates: string[],
  note?: string,
): Readout {
  const rows = (byLabel.get(label) || []).slice().sort((a, b) => b.periodStart.localeCompare(a.periodStart));
  const direction = rows[0]?.direction || directionFor(label);
  const kind = kindOf(rows);
  const weekRows = rows.filter((row) => row.periodType === "week");
  const carrier = weekRows[0] || rows[0];
  const thisRow = featuredWeek ? weekRows.find((row) => row.periodStart === featuredWeek) : weekRows[0];
  const trailValues = trailDates
    .map((date) => weekRows.find((row) => row.periodStart === date))
    .filter((row): row is Obs => Boolean(row && row.valueNumeric != null));
  const trailAvg = average(trailValues.map((row) => row.valueNumeric as number));
  const sample = thisRow?.valueRaw || trailValues[0]?.valueRaw || carrier?.avgRaw || carrier?.totalRaw;
  const wkGoal = carrier?.wkNumeric ?? null;
  const wkGoalRaw = carrier?.wkRaw ?? null;

  const thisWindow: WindowView = {
    label: "This week",
    value: thisRow?.valueRaw || "Awaiting data",
    goal: thisRow ? wkGoalRaw : wkGoalRaw,
    status: thisRow ? rate(thisRow.valueNumeric, wkGoal, direction) : "none",
  };
  const trailWindow: WindowView = {
    label: "Trailing 4 weeks",
    value: trailAvg == null ? "Awaiting data" : formatAverage(trailAvg, kind, sample),
    goal: wkGoalRaw,
    status: rate(trailAvg, wkGoal, direction),
  };

  let paceLabel = "Pace";
  let paceValue: string = "Awaiting data";
  let paceNumber: number | null = null;
  let paceGoal: number | null = null;
  let paceGoalRaw: string | null = null;
  if (carrier?.totalNumeric != null && carrier.goalNumeric != null) {
    paceLabel = /ytd/i.test(label) ? "YTD" : "QTD";
    paceValue = carrier.totalRaw || formatNumber(carrier.totalNumeric, kind, sample);
    paceNumber = carrier.totalNumeric;
    paceGoal = carrier.goalNumeric;
    paceGoalRaw = carrier.goalRaw;
  } else if (carrier?.avgNumeric != null && carrier.goalNumeric != null) {
    paceLabel = "QTD avg";
    paceValue = carrier.avgRaw || formatNumber(carrier.avgNumeric, kind, sample);
    paceNumber = carrier.avgNumeric;
    paceGoal = carrier.goalNumeric;
    paceGoalRaw = carrier.goalRaw;
  } else if (carrier?.totalNumeric != null && carrier.goalNumeric == null) {
    paceLabel = /ytd/i.test(label) ? "YTD" : "QTD";
    paceValue = carrier.totalRaw || formatNumber(carrier.totalNumeric, kind, sample);
  } else if (carrier?.avgNumeric != null && !weekRows.length) {
    paceLabel = "Average";
    paceValue = carrier.avgRaw || formatNumber(carrier.avgNumeric, kind, sample);
    paceNumber = carrier.avgNumeric;
    paceGoal = carrier.goalNumeric;
    paceGoalRaw = carrier.goalRaw;
  }

  const paceWindow: WindowView = {
    label: paceLabel,
    value: paceValue,
    goal: paceGoalRaw,
    status: rate(paceNumber, paceGoal, direction),
  };
  const windows = [thisWindow, trailWindow, paceWindow];
  const history = historyDates.map((date) => {
    const row = weekRows.find((item) => item.periodStart === date);
    return { week: formatIsoDate(date), value: row?.valueRaw || "Awaiting data" };
  });
  const headlineNumber = carrier?.totalNumeric ?? thisRow?.valueNumeric ?? carrier?.avgNumeric ?? null;
  const headline = carrier?.totalRaw || thisRow?.valueRaw || carrier?.avgRaw || (rows.length ? "Awaiting data" : "Awaiting data");
  const headlineGoal = carrier?.goalRaw || wkGoalRaw;
  return {
    label,
    overall: rows.length ? worstStatus(windows.map((window) => window.status)) : "none",
    headline: rows.length ? headline : "Awaiting data",
    headlineGoal: rows.length ? headlineGoal : null,
    windows,
    history,
    updated: formatTimestamp(carrier?.updatedAt),
    source: sourceLabel(carrier),
    note,
    ...(headlineNumber == null ? {} : {}),
  };
}

function awaitingReadout(label: string, note?: string): Readout {
  const blank: WindowView = { label: "", value: "Awaiting data", goal: null, status: "none" };
  return {
    label,
    overall: "none",
    headline: "Awaiting data",
    headlineGoal: null,
    windows: [
      { ...blank, label: "This week" },
      { ...blank, label: "Trailing 4 weeks" },
      { ...blank, label: "Pace" },
    ],
    history: [],
    updated: null,
    source: "Awaiting data",
    note,
  };
}

function orAwaiting(
  byLabel: Map<string, Obs[]>,
  featured: string | null,
  trail: string[],
  history: string[],
  label: string,
  note?: string,
): Readout {
  if (!byLabel.has(label)) return awaitingReadout(label, note);
  return buildReadout(byLabel, featured, label, trail, history, note);
}

async function loadMonthly(): Promise<Monthly[]> {
  const rows = await sql<Record<string, unknown>>(
    "SELECT * FROM monthly_financials ORDER BY period ASC",
  );
  return rows.map((row) => ({
    period: asIso(row.period),
    revenueActual: num(row.revenue_actual),
    revenueBudget: num(row.revenue_budget),
    grossMarginActual: num(row.gross_margin_actual),
    grossMarginAppraisal: num(row.gross_margin_appraisal),
    grossMarginNonAppraisal: num(row.gross_margin_non_appraisal),
    ebitdaActual: num(row.ebitda_actual),
    ebitdaBudget: num(row.ebitda_budget),
    ebitdaMarginActual: num(row.ebitda_margin_actual),
    expensesActual: num(row.expenses_actual),
    expensesBudget: num(row.expenses_budget),
    filename: row.filename == null ? null : String(row.filename),
    source: row.source == null ? "" : String(row.source),
    updatedAt: asTime(row.updated_at),
  }));
}

async function loadFinanceBoard(): Promise<FinanceBoard | null> {
  const rows = await sql<{ payload: string; received_on: unknown; source: string }>(
    "SELECT payload, received_on, source FROM budget_snapshots ORDER BY period_end DESC, created_at DESC LIMIT 1",
  );
  const row = rows[0];
  if (!row) return null;
  const received = row.received_on ? asIso(row.received_on) : "";
  return presentBudget(parseBudgetSnapshot(JSON.parse(row.payload)), received, row.source);
}

function annualizedRevenue(months: Monthly[]): { value: number; months: number; label: string } | null {
  const withRevenue = months.filter((month) => month.revenueActual != null && !month.source.startsWith("bva:"));
  if (!withRevenue.length) return null;
  const sum = withRevenue.reduce((total, month) => total + (month.revenueActual as number), 0);
  const value = (sum / withRevenue.length) * 12;
  const label =
    withRevenue.length === 1
      ? `${formatIsoDate(withRevenue[0].period).replace(/^\d+\s/, "")} actual × 12`
      : `Average of ${withRevenue.length} monthly actuals × 12`;
  return { value, months: withRevenue.length, label };
}

export async function getDashboard(): Promise<DashboardModel> {
  const { featuredWeek, byLabel } = await loadObservations();
  const calendar = weekCalendar(byLabel, featuredWeek);
  const targetsRows = await sql<{ key: string; value_numeric: number | null }>("SELECT key, value_numeric FROM targets");
  const targets: Record<string, number | null> = {};
  for (const row of targetsRows) targets[row.key] = num(row.value_numeric);
  const months = await loadMonthly();
  const latest = months.at(-1) || null;
  const budget = await loadFinanceBoard();
  const runRate = annualizedRevenue(months);
  const upside = targets.revenue_run_rate_2027_upside;
  const order = buildReadout(byLabel, featuredWeek, LABELS.orderRevenue, calendar.trail, calendar.history);
  const gm = buildReadout(byLabel, featuredWeek, LABELS.grossMargin, calendar.trail, calendar.history);
  const gmGoal = targets.gross_margin_blended;
  const ebitdaTarget = targets.ebitda_margin;

  const revenueLines = [
    {
      label: "2027 upside case",
      value: upside == null ? "Awaiting data" : formatUsd(upside),
    },
    {
      label: "Official run rate vs upside case",
      value: runRate && upside != null ? `${formatUsd(runRate.value)} · ${runRate.label}` : "Awaiting data",
    },
  ];
  const revenueHero: Hero = {
    id: "revenue",
    kicker: "Scoreboard",
    title: "Revenue run rate vs plan",
    overall: runRate && upside != null ? rate(runRate.value, upside, "higher") : "none",
    headline: runRate ? formatUsd(runRate.value) : "Awaiting data",
    caption: runRate ? runRate.label : "Official revenue run rate",
    goal: upside == null ? "2027 upside case not set" : `2027 upside case ${formatUsd(upside)}`,
    windows: order.windows,
    lines: revenueLines,
    updated: runRate ? formatTimestamp(latest?.updatedAt) : order.updated,
    source: runRate
      ? `Monthly budget vs actual${latest?.filename ? ` · ${latest.filename}` : ""}`
      : `${order.source}. Weekly color uses ${LABELS.orderRevenue}.`,
  };

  const appraisal = latest?.grossMarginAppraisal;
  const nonAppraisal = latest?.grossMarginNonAppraisal;
  const gmHero: Hero = {
    id: "gross-margin",
    kicker: "Scoreboard",
    title: "Gross margin",
    overall: gm.overall,
    headline: gm.headline,
    caption: gm.headlineGoal ? `Goal ${gm.headlineGoal}` : "Blended",
    goal: gmGoal == null ? "Goal not set" : `Blended goal ${gmGoal}%`,
    windows: gm.windows,
    lines: [
      budget
        ? {
            label: `BvA YTD gross margin, as of ${budget.periodLabel}`,
            value: `${budget.scoreboard.ytdGrossMargin} vs budget ${budget.scoreboard.ytdGrossMarginBudget}`,
          }
        : { label: "BvA gross margin", value: "Awaiting data" },
      { label: "Appraisal gross margin", value: appraisal == null ? "Awaiting data" : `${appraisal}%` },
      { label: "Non-appraisal gross margin", value: nonAppraisal == null ? "Awaiting data" : `${nonAppraisal}%` },
    ],
    updated: gm.updated,
    source: gm.source,
  };

  let ebitdaHeadline = "Awaiting data";
  let ebitdaStatus: Status = "none";
  let ebitdaUpdated: string | null = null;
  let ebitdaSource = "Awaiting data";
  let ebitdaCaption = "From the monthly budget vs actual workbook";
  let ebitdaGoal = ebitdaTarget == null ? "Long Ridge target not set" : `Long Ridge target ${ebitdaTarget}%`;
  const ebitdaLines: { label: string; value: string }[] = [
    {
      label: "Long Ridge target (reference, not the budget)",
      value: ebitdaTarget == null ? "Awaiting data" : `${ebitdaTarget}%`,
    },
    { label: "YTD reported EBITDA vs budget", value: "Awaiting data" },
  ];
  let ebitdaWindows: WindowView[] = [
    { label: "September", value: "Awaiting data", goal: null, status: "none" },
    { label: "YTD", value: "Awaiting data", goal: null, status: "none" },
    { label: "Q3", value: "Awaiting data", goal: null, status: "none" },
  ];
  if (budget) {
    const board = budget.scoreboard;
    ebitdaHeadline = board.ytdMargin;
    ebitdaCaption = "YTD reported EBITDA margin vs its budget";
    ebitdaGoal = `YTD budget ${board.ytdBudget}`;
    ebitdaUpdated = budget.updated;
    ebitdaSource = `${budget.source} · as of ${budget.periodLabel}`;
    const septemberStatus = rate(board.septemberMarginNumber, board.septemberBudgetNumber, "higher");
    const ytdStatus = rate(board.ytdMarginNumber, board.ytdBudgetNumber, "higher");
    const q3Status = rate(board.q3MarginNumber, board.q3BudgetNumber, "higher");
    ebitdaStatus = worstStatus([septemberStatus, ytdStatus]);
    ebitdaWindows = [
      { label: "September", value: board.septemberMargin, goal: board.septemberBudget, status: septemberStatus },
      { label: "YTD", value: board.ytdMargin, goal: board.ytdBudget, status: ytdStatus },
      { label: "Q3", value: board.q3Margin, goal: board.q3Budget, status: q3Status },
    ];
    ebitdaLines[1] = { label: "YTD reported EBITDA vs budget", value: board.ytdEbitdaVariance };
  } else if (latest && (latest.ebitdaMarginActual != null || (latest.ebitdaActual != null && latest.revenueActual))) {
    const margin =
      latest.ebitdaMarginActual != null
        ? latest.ebitdaMarginActual
        : ((latest.ebitdaActual as number) / (latest.revenueActual as number)) * 100;
    ebitdaHeadline = `${Number(margin.toFixed(1))}%`;
    ebitdaStatus = rate(margin, ebitdaTarget, "higher");
    ebitdaUpdated = formatTimestamp(latest.updatedAt);
    ebitdaSource = `Monthly budget vs actual${latest.filename ? ` · ${latest.filename}` : ""}`;
    ebitdaWindows = [
      { label: "This month", value: ebitdaHeadline, goal: ebitdaTarget == null ? null : `${ebitdaTarget}%`, status: ebitdaStatus },
      { label: "Trailing 4 weeks", value: "Awaiting data", goal: null, status: "none" },
      { label: "YTD", value: "Awaiting data", goal: null, status: "none" },
    ];
  }
  const ebitdaHero: Hero = {
    id: "ebitda",
    kicker: "Scoreboard",
    title: "Reported EBITDA margin",
    overall: ebitdaStatus,
    headline: ebitdaHeadline,
    caption: ebitdaCaption,
    goal: ebitdaGoal,
    windows: ebitdaWindows,
    lines: ebitdaLines,
    updated: ebitdaUpdated,
    source: ebitdaSource,
  };

  const read = (label: string, note?: string) => orAwaiting(byLabel, featuredWeek, calendar.trail, calendar.history, label, note);
  const newSales = [LABELS.newElUpsell, LABELS.meetings, LABELS.newClientOrders, LABELS.sdrClosedWon, LABELS.goalOrderYtd].map(
    (label) => read(label),
  );
  newSales.push(
    awaitingReadout("Pipeline coverage", "Not on the weekly scorecard. It will fill from Salesforce pipeline once connected."),
  );

  const upsellTarget = targets.non_appraisal_revenue_2027;
  const stretch = targets.non_appraisal_revenue_stretch;
  const upsell = [
    read(LABELS.evaluation, "Realization % from the MarketPlace Sales Scorecard. Not dollar revenue."),
    read(LABELS.newEl),
    awaitingReadout(
      "Non-appraisal revenue",
      upsellTarget == null
        ? "2027 target is not set."
        : `2027 target ${formatUsd(upsellTarget)}${stretch ? ` · stretch ${formatUsd(stretch)}` : ""}. Dollar actuals are awaiting data.`,
    ),
    awaitingReadout("Clients using a 2nd service", "Counted from a ValuTrac export once a product column is present."),
    awaitingReadout("Repeat paid orders", "Counted from a ValuTrac export once order history is uploaded."),
  ];

  const ma = [LABELS.maPipeline, LABELS.ndaSent, LABELS.ndaSigned, LABELS.loiSent, LABELS.loiSigned].map((label) => read(label));
  const acquired = targets.ma_acquired_annual_revenue;
  ma.push(
    awaitingReadout("M&A diligence", "Not a row on the weekly scorecard."),
    awaitingReadout(
      "Acquired annual revenue closed",
      acquired == null ? "Assumption not set." : `Assumption ${formatUsd(acquired)}. Closed revenue is awaiting data.`,
    ),
    awaitingReadout("Post-close retention", "Not on the weekly scorecard."),
  );

  const defense = [
    read(LABELS.logoChurn, "Ceiling. Lower is better."),
    read(LABELS.yoyRetention),
    read(LABELS.zeroOrders, "Sales scorecard average. No weekly values were in the source, so this week is awaiting data."),
    awaitingReadout("At-risk accounts by tier", "Awaiting Salesforce cases or an at-risk upload."),
    awaitingReadout("Early-warning order-volume drop", "Appears after a ValuTrac export is uploaded. Drop means more than 20% below that client's prior 90-day weekly baseline."),
  ];

  const operations = [
    read(LABELS.crr, "Weekly total of collateral risk reviews by team leads and CRAs. Not files completed by CRA versus fee appraisers."),
    read(LABELS.qcr, "Weekly quality-control review total."),
    read(LABELS.late, "Lower is better."),
    read(LABELS.commercial, "Lower is better."),
    read(LABELS.residential, "Lower is better."),
    read(LABELS.utilization),
    awaitingReadout("CRA files completed", "Files completed by Collateral Risk Associates. Awaiting a ValuTrac export."),
    awaitingReadout("Fee appraiser files completed", "Awaiting a ValuTrac export."),
    awaitingReadout("Avg fee / cost / margin per CRA file", "Awaiting a ValuTrac export."),
    awaitingReadout("Avg fee / cost / margin per fee-appraiser file", "Awaiting a ValuTrac export."),
    awaitingReadout("CRA avg turn time (BD)", "Awaiting a ValuTrac export."),
    awaitingReadout("Fee appraiser avg turn time (BD)", "Awaiting a ValuTrac export."),
    awaitingReadout("CRA revision rate", "Awaiting a ValuTrac export."),
    awaitingReadout("Fee appraiser revision rate", "Awaiting a ValuTrac export."),
  ];

  const counted = [...newSales, ...upsell, ...ma, ...defense, ...operations, gm];
  const counts = {
    onTrack: counted.filter((item) => item.overall === "green").length,
    watch: counted.filter((item) => item.overall === "yellow").length,
    offTrack: counted.filter((item) => item.overall === "red").length,
    awaiting: counted.filter((item) => item.overall === "none").length,
  };

  let note: DashboardModel["note"] = null;
  if (featuredWeek) {
    const notes = await sql<Record<string, unknown>>(
      "SELECT week_ending, what_changed, owner, next_step, updated_at FROM notes WHERE week_ending = $1",
      [featuredWeek],
    );
    if (notes[0]) {
      note = {
        weekEnding: asIso(notes[0].week_ending),
        whatChanged: String(notes[0].what_changed || ""),
        owner: String(notes[0].owner || ""),
        nextStep: String(notes[0].next_step || ""),
        updated: formatTimestamp(asTime(notes[0].updated_at)),
      };
    }
  }

  const orderRows = await sql<Record<string, unknown>>(
    `SELECT client_name, order_date, completed_date, appraiser_type, fee, cost, turn_time_bd, revised, late, product
     FROM order_rows`,
  );
  const lines: OrderLine[] = orderRows.map((row) => ({
    clientName: row.client_name == null ? null : String(row.client_name),
    orderDate: row.order_date == null ? null : asIso(row.order_date),
    completedDate: row.completed_date == null ? null : asIso(row.completed_date),
    appraiserType: row.appraiser_type === "cra" || row.appraiser_type === "fee" ? row.appraiser_type : "unknown",
    fee: num(row.fee),
    cost: num(row.cost),
    turnTimeBd: num(row.turn_time_bd),
    revised: row.revised == null ? null : Boolean(row.revised),
    late: row.late == null ? null : Boolean(row.late),
    product: row.product == null ? null : String(row.product),
  }));
  let orderAsOf: string | null = null;
  let orders: OrderSummary | null = null;
  if (lines.length) {
    const dates = lines.map((line) => line.completedDate || line.orderDate).filter((value): value is string => Boolean(value));
    orderAsOf = dates.sort().at(-1) || null;
    orders = summarizeOrders(lines, orderAsOf ? new Date(`${orderAsOf}T00:00:00Z`) : new Date());
    const source = `ValuTrac order upload${orderAsOf ? ` · as of ${formatIsoDate(orderAsOf)}` : ""}`;
    const money = (value: number | null) =>
      value == null
        ? "Awaiting data"
        : value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
    const stamp = (list: Readout[], label: string, headline: string, note?: string, status: Status = "none") => {
      let item = list.find((readout) => readout.label === label);
      if (!item) {
        item = awaitingReadout(label);
        list.push(item);
      }
      item.headline = headline;
      item.overall = status;
      item.source = source;
      item.updated = orderAsOf ? formatIsoDate(orderAsOf) : null;
      item.note = note;
      item.windows = [
        { label: "This week", value: headline, goal: null, status },
        { label: "Trailing 4 weeks", value: "Awaiting data", goal: null, status: "none" },
        { label: "Pace", value: "Awaiting data", goal: null, status: "none" },
      ];
    };
    stamp(upsell, "Repeat paid orders", String(orders.repeatPaidClients ?? "Awaiting data"));
    if (orders.clientsWithSecondService != null) {
      stamp(upsell, "Clients using a 2nd service", String(orders.clientsWithSecondService));
    }
    stamp(
      defense,
      "Early-warning order-volume drop",
      String(orders.earlyWarnings.length),
      orders.earlyWarnings.length
        ? orders.earlyWarnings
            .slice(0, 8)
            .map((item) => `${item.client}: ${item.recent} recent vs ${item.baselineWeekly.toFixed(1)} baseline/week`)
            .join("; ")
        : "No client is more than 20% below its prior 90-day weekly baseline.",
      orders.earlyWarnings.length ? "red" : "green",
    );
    stamp(operations, "CRA files completed", String(orders.cra.files), `Share of classified files ${orders.craShare == null ? "Awaiting data" : `${orders.craShare.toFixed(1)}%`}.`);
    stamp(operations, "Fee appraiser files completed", String(orders.fee.files));
    stamp(operations, "Avg fee / cost / margin per CRA file", `${money(orders.cra.avgFee)} / ${money(orders.cra.avgCost)} / ${money(orders.cra.avgMargin)}`);
    stamp(operations, "Avg fee / cost / margin per fee-appraiser file", `${money(orders.fee.avgFee)} / ${money(orders.fee.avgCost)} / ${money(orders.fee.avgMargin)}`);
    stamp(operations, "CRA avg turn time (BD)", orders.cra.avgTurn == null ? "Awaiting data" : orders.cra.avgTurn.toFixed(1));
    stamp(operations, "Fee appraiser avg turn time (BD)", orders.fee.avgTurn == null ? "Awaiting data" : orders.fee.avgTurn.toFixed(1));
    stamp(
      operations,
      "CRA revision rate",
      orders.cra.revisionRate == null ? "Awaiting data" : `${orders.cra.revisionRate.toFixed(1)}%`,
    );
    stamp(
      operations,
      "Fee appraiser revision rate",
      orders.fee.revisionRate == null ? "Awaiting data" : `${orders.fee.revisionRate.toFixed(1)}%`,
    );
  }

  const atRiskRows = await sql<Record<string, unknown>>(
    "SELECT client_name, tier, reason, annual_value, source FROM at_risk_accounts ORDER BY client_name",
  );
  const deals = await sql<Record<string, unknown>>(
    "SELECT opportunity_name, amount, age, close_date, expected_monthly_appraisals, weekly_goal, actual_uploads, diff, as_of, workbook_meta FROM augur_deals",
  );
  deals.sort((a, b) => (num(b.amount) ?? -1) - (num(a.amount) ?? -1) || String(a.opportunity_name).localeCompare(String(b.opportunity_name)));
  if (atRiskRows.length) {
    const item = defense.find((readout) => readout.label === "At-risk accounts by tier");
    if (item) {
      item.headline = String(atRiskRows.length);
      item.overall = "yellow";
      item.source = String(atRiskRows[0].source || "At-risk upload");
      item.windows = [
        { label: "This week", value: String(atRiskRows.length), goal: null, status: "yellow" },
        { label: "Trailing 4 weeks", value: "Awaiting data", goal: null, status: "none" },
        { label: "Pace", value: "Awaiting data", goal: null, status: "none" },
      ];
    }
  }

  const countedNow = [...newSales, ...upsell, ...ma, ...defense, ...operations, gm];
  counts.onTrack = countedNow.filter((item) => item.overall === "green").length;
  counts.watch = countedNow.filter((item) => item.overall === "yellow").length;
  counts.offTrack = countedNow.filter((item) => item.overall === "red").length;
  counts.awaiting = countedNow.filter((item) => item.overall === "none").length;

  let augur: DashboardModel["augur"] = null;
  if (deals.length) {
    const meta = deals[0].workbook_meta ? (JSON.parse(String(deals[0].workbook_meta)) as Record<string, unknown>) : {};
    augur = {
      asOf: deals[0].as_of == null ? null : String(deals[0].as_of),
      weekOf: meta.weekOf == null ? null : String(meta.weekOf),
      uploadsTotal: num(meta.uploadsTotal),
      weeklyGoalTotal: num(meta.weeklyGoalTotal),
      annualVolumePreOctober: num(meta.annualVolumePreOctober),
      deals: deals.map((deal) => ({
        opportunityName: String(deal.opportunity_name),
        amount: num(deal.amount),
        age: num(deal.age),
        closeDate: deal.close_date == null ? null : String(deal.close_date),
        expectedMonthlyAppraisals: num(deal.expected_monthly_appraisals),
        weeklyGoal: num(deal.weekly_goal),
        actualUploads: num(deal.actual_uploads),
        diff: num(deal.diff),
      })),
    };
  }

  return {
    featuredWeek,
    featuredLabel: featuredWeek ? formatIsoDate(featuredWeek) : "Awaiting data",
    salesforce: await salesforceView(),
    heroes: [revenueHero, gmHero, ebitdaHero],
    newSales,
    upsell,
    ma,
    defense,
    operations,
    counts,
    note,
    orders,
    orderAsOf,
    atRisk: atRiskRows.map((row) => ({
      clientName: String(row.client_name),
      tier: row.tier == null ? null : String(row.tier),
      reason: row.reason == null ? null : String(row.reason),
      annualValue: num(row.annual_value),
      source: String(row.source),
    })),
    augur,
    monthly: latest,
    targets,
  };
}

export async function sectionReadouts(section: string): Promise<{ featuredWeek: string | null; readouts: Readout[] }> {
  const { featuredWeek, byLabel, catalog } = await loadObservations();
  const calendar = weekCalendar(byLabel, featuredWeek);
  const labels = catalog.filter((item) => item.section === section).map((item) => item.label);
  return {
    featuredWeek,
    readouts: labels.map((label) => buildReadout(byLabel, featuredWeek, label, calendar.trail, calendar.history)),
  };
}

export async function financeReadouts(): Promise<{ featuredWeek: string | null; readouts: Readout[]; monthly: Monthly | null; budget: FinanceBoard | null }> {
  const { featuredWeek, byLabel, catalog } = await loadObservations();
  const calendar = weekCalendar(byLabel, featuredWeek);
  const labels = catalog.filter((item) => item.category === "Fin").map((item) => item.label);
  const months = await loadMonthly();
  return {
    featuredWeek,
    readouts: labels.map((label) => buildReadout(byLabel, featuredWeek, label, calendar.trail, calendar.history)),
    monthly: months.at(-1) || null,
    budget: await loadFinanceBoard(),
  };
}
