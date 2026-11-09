import { saveMonthly, recordUpload, replaceAugurDeals, replaceOrders, upsertMetrics } from "./apply";
import { query } from "./db";
import { weekLabelToIso } from "./format";
import { parseAugurWorkbook } from "./importers/augur";
import { parseBudgetWorkbook, type BudgetMapping } from "./importers/budget";
import { parseOrderCsv } from "./importers/orders";
import { parseScorecardCsv, parseScorecardText, type ParsedMetric } from "./importers/scorecard";
import { workbookMatrices } from "./importers/matrix";
import { parseScorecardMatrix } from "./importers/scorecard";
import { DEFAULT_BUDGET_MAPPING } from "./targets";

export async function activeBudgetMapping(): Promise<BudgetMapping> {
  const rows = await query<{ config: string }>(
    "SELECT config FROM parser_mappings WHERE kind = 'budget' AND active = TRUE ORDER BY updated_at DESC LIMIT 1",
  );
  if (!rows[0]) return DEFAULT_BUDGET_MAPPING;
  try {
    const parsed = JSON.parse(rows[0].config) as BudgetMapping;
    if (!parsed.rowLabels) return DEFAULT_BUDGET_MAPPING;
    return parsed;
  } catch {
    return DEFAULT_BUDGET_MAPPING;
  }
}

export function rowsToMetrics(
  rows: {
    label: string;
    section?: string;
    category?: string;
    weekEnding?: string;
    value?: string | null;
    totalQtd?: string | null;
    avgQtd?: string | null;
    qtdGoal?: string | null;
    qtdGoalPct?: string | null;
    wkGoal?: string | null;
  }[],
): ParsedMetric[] {
  const byLabel = new Map<string, ParsedMetric>();
  for (const row of rows) {
    const label = row.label?.trim();
    if (!label) continue;
    let metric = byLabel.get(label);
    if (!metric) {
      metric = {
        section: row.section || "MarketPlace",
        category: row.category || "Revenue",
        label,
        totalQtd: row.totalQtd ?? null,
        avgQtd: row.avgQtd ?? null,
        qtdGoal: row.qtdGoal ?? null,
        qtdGoalPct: row.qtdGoalPct ?? null,
        wkGoal: row.wkGoal ?? null,
        weekly: {},
      };
      byLabel.set(label, metric);
    }
    if (row.totalQtd) metric.totalQtd = row.totalQtd;
    if (row.avgQtd) metric.avgQtd = row.avgQtd;
    if (row.qtdGoal) metric.qtdGoal = row.qtdGoal;
    if (row.qtdGoalPct) metric.qtdGoalPct = row.qtdGoalPct;
    if (row.wkGoal) metric.wkGoal = row.wkGoal;
    if (row.weekEnding && row.value) {
      const iso = weekLabelToIso(row.weekEnding) || (/^\d{4}-\d{2}-\d{2}$/.test(row.weekEnding) ? row.weekEnding : null);
      if (iso) metric.weekly[iso] = row.value;
    }
  }
  return [...byLabel.values()];
}

export async function intakeScorecard(options: {
  text?: string;
  filename?: string;
  buffer?: Buffer;
  metrics?: ParsedMetric[];
  actor: string | null;
  source?: string;
  sourceDetail?: string;
}): Promise<{ metrics: number; message: string }> {
  let parsed: ParsedMetric[] = options.metrics || [];
  let message = "Scorecard saved.";
  if (options.text?.trim()) {
    const result = parseScorecardText(options.text);
    if (!result.metrics.length) {
      const csv = parseScorecardCsv(options.text);
      parsed = csv?.metrics || [];
    } else {
      parsed = result.metrics;
    }
  } else if (options.buffer && options.filename?.match(/\.csv$/i)) {
    parsed = parseScorecardCsv(options.buffer.toString("utf8"))?.metrics || [];
  } else if (options.buffer) {
    const augur = await parseAugurWorkbook(options.buffer);
    if (augur && augur.deals.length) {
      await replaceAugurDeals(augur, "augur-upload");
      await recordUpload("augur", options.filename || "augur.xlsx", options.actor, "saved", `Imported ${augur.deals.length} Augur rows.`);
      return { metrics: augur.deals.length, message: `Imported ${augur.deals.length} Augur closed-won rows. This workbook is deal detail, not the leadership scorecard.` };
    }
    const sheets = await workbookMatrices(options.buffer);
    for (const sheet of sheets) {
      const table = parseScorecardMatrix(sheet.rows);
      if (table?.metrics.length) parsed = parsed.concat(table.metrics);
    }
  }
  if (!parsed.length) {
    throw new Error("No scorecard metrics were found in that file.");
  }
  const now = new Date().toISOString();
  const written = await upsertMetrics(
    parsed,
    options.source || "manual",
    options.sourceDetail || `Entered by ${options.actor || "an admin"}`,
    now,
    now.slice(0, 10),
  );
  await recordUpload("scorecard", options.filename || "manual", options.actor, "saved", message);
  return { metrics: written, message };
}

export async function intakeBudget(buffer: Buffer, filename: string, actor: string | null): Promise<{ periods: number; warnings: string[] }> {
  const mapping = await activeBudgetMapping();
  const parsed = await parseBudgetWorkbook(buffer, filename, mapping);
  if (!parsed.periods.length) {
    throw new Error(parsed.warnings.join(" ") || "No monthly rows matched the parser mapping.");
  }
  for (const period of parsed.periods) {
    await saveMonthly(period, "budget-upload", filename);
  }
  await recordUpload("budget", filename, actor, "saved", `Saved ${parsed.periods.length} month(s). ${parsed.warnings.join(" ")}`.trim());
  return { periods: parsed.periods.length, warnings: parsed.warnings };
}

export async function intakeOrders(text: string, filename: string, actor: string | null): Promise<{ rows: number }> {
  const lines = parseOrderCsv(text);
  if (!lines.length) throw new Error("No order rows were found. Expected a header row with client, dates, appraiser type, fee, and cost.");
  const rows = await replaceOrders(lines, filename, actor);
  await recordUpload("orders", filename, actor, "saved", `Replaced order lines with ${rows} rows.`);
  return { rows };
}
