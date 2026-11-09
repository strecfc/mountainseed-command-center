import { parseNumeric, periodFromFilename } from "../format";
import { DEFAULT_BUDGET_MAPPING } from "../targets";
import { workbookMatrices } from "./matrix";

export type BudgetMapping = {
  rowLabels: Record<string, string[]>;
};

export type MonthlyActuals = {
  period: string;
  revenueActual: number | null;
  revenueBudget: number | null;
  grossProfitActual: number | null;
  grossProfitBudget: number | null;
  grossMarginActual: number | null;
  grossMarginBudget: number | null;
  grossMarginAppraisal: number | null;
  grossMarginNonAppraisal: number | null;
  ebitdaActual: number | null;
  ebitdaBudget: number | null;
  ebitdaMarginActual: number | null;
  ebitdaMarginBudget: number | null;
  expensesActual: number | null;
  expensesBudget: number | null;
};

export type BudgetParse = {
  periods: MonthlyActuals[];
  warnings: string[];
};

const FIELD_BY_KEY: Record<string, { actual: keyof MonthlyActuals; budget: keyof MonthlyActuals; percent: boolean }> = {
  revenue: { actual: "revenueActual", budget: "revenueBudget", percent: false },
  gross_profit: { actual: "grossProfitActual", budget: "grossProfitBudget", percent: false },
  gross_margin: { actual: "grossMarginActual", budget: "grossMarginBudget", percent: true },
  gross_margin_appraisal: { actual: "grossMarginAppraisal", budget: "grossMarginAppraisal", percent: true },
  gross_margin_non_appraisal: { actual: "grossMarginNonAppraisal", budget: "grossMarginNonAppraisal", percent: true },
  ebitda: { actual: "ebitdaActual", budget: "ebitdaBudget", percent: false },
  ebitda_margin: { actual: "ebitdaMarginActual", budget: "ebitdaMarginBudget", percent: true },
  expenses: { actual: "expensesActual", budget: "expensesBudget", percent: false },
};

function normalizeLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/%/g, " percent ")
    .replace(/\$/g, " dollars ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchField(label: string, mapping: BudgetMapping): string | null {
  const norm = normalizeLabel(label);
  if (!norm) return null;
  let best: { key: string; score: number } | null = null;
  for (const [key, aliases] of Object.entries(mapping.rowLabels)) {
    for (const alias of aliases) {
      const aliasNorm = normalizeLabel(alias);
      if (!aliasNorm) continue;
      const exact = norm === aliasNorm;
      const partial =
        !exact && aliasNorm.length >= 6 && (norm.includes(aliasNorm) || (aliasNorm.includes(norm) && norm.length >= 6));
      if (!exact && !partial) continue;
      const score = aliasNorm.length + (exact ? 100 : 0);
      if (!best || score > best.score) best = { key, score };
    }
  }
  return best?.key ?? null;
}

function asNumber(raw: string, percent: boolean): number | null {
  const n = parseNumeric(raw);
  if (n == null) return null;
  if (percent && Math.abs(n) <= 1 && raw.includes(".") && !raw.includes("%") && Math.abs(n) > 0) {
    return n * 100;
  }
  return n;
}

function emptyPeriod(period: string): MonthlyActuals {
  return {
    period,
    revenueActual: null,
    revenueBudget: null,
    grossProfitActual: null,
    grossProfitBudget: null,
    grossMarginActual: null,
    grossMarginBudget: null,
    grossMarginAppraisal: null,
    grossMarginNonAppraisal: null,
    ebitdaActual: null,
    ebitdaBudget: null,
    ebitdaMarginActual: null,
    ebitdaMarginBudget: null,
    expensesActual: null,
    expensesBudget: null,
  };
}

type ColumnPair = { actual: number; budget: number; period: string | null };

function findColumns(rows: string[][], filenamePeriod: string | null): { headerRow: number; pairs: ColumnPair[] } | null {
  for (let r = 0; r < Math.min(rows.length, 15); r += 1) {
    const row = rows[r];
    const actuals: number[] = [];
    const budgets: number[] = [];
    row.forEach((cell, index) => {
      if (/^actual(s)?$/i.test(cell.trim()) || /\bactual\b/i.test(cell) && !/budget/i.test(cell)) actuals.push(index);
      if (/^budget$/i.test(cell.trim()) || /\bbudget\b/i.test(cell)) budgets.push(index);
    });
    if (actuals.length && budgets.length) {
      const pairs: ColumnPair[] = [];
      const count = Math.max(actuals.length, budgets.length);
      for (let i = 0; i < count; i += 1) {
        if (actuals[i] == null || budgets[i] == null) continue;
        const header = `${row[actuals[i]]} ${row[budgets[i]]}`;
        pairs.push({
          actual: actuals[i],
          budget: budgets[i],
          period: periodFromFilename(header) || (count === 1 ? filenamePeriod : null),
        });
      }
      if (pairs.length) return { headerRow: r, pairs };
    }
  }
  return null;
}

export function parseBudgetMatrices(
  sheets: { name: string; rows: string[][] }[],
  filename: string,
  mapping: BudgetMapping = DEFAULT_BUDGET_MAPPING,
): BudgetParse {
  const warnings: string[] = [];
  const filenamePeriod = periodFromFilename(filename);
  const byPeriod = new Map<string, MonthlyActuals>();
  let matched = 0;

  for (const sheet of sheets) {
    const columns = findColumns(sheet.rows, filenamePeriod);
    if (!columns) {
      warnings.push(`Sheet "${sheet.name}" has no Actual and Budget columns.`);
      continue;
    }
    for (const row of sheet.rows.slice(columns.headerRow + 1)) {
      const label = row.map((cell) => cell.trim()).find(Boolean) || "";
      const field = matchField(label, mapping);
      if (!field || !FIELD_BY_KEY[field]) continue;
      const spec = FIELD_BY_KEY[field];
      for (const pair of columns.pairs) {
        const period = pair.period || filenamePeriod;
        if (!period) {
          warnings.push(`Matched "${label}" but could not tell which month it belongs to.`);
          continue;
        }
        const record = byPeriod.get(period) || emptyPeriod(period);
        const actual = asNumber(row[pair.actual] || "", spec.percent);
        const budget = asNumber(row[pair.budget] || "", spec.percent);
        if (actual != null) record[spec.actual] = actual as never;
        if (budget != null && spec.actual !== spec.budget) record[spec.budget] = budget as never;
        byPeriod.set(period, record);
        matched += 1;
      }
    }
  }

  if (!matched) {
    warnings.push("No revenue, margin, EBITDA, or expense rows matched the parser mapping.");
  }
  return { periods: [...byPeriod.values()].sort((a, b) => a.period.localeCompare(b.period)), warnings };
}

export async function parseBudgetWorkbook(
  buffer: Buffer,
  filename: string,
  mapping: BudgetMapping = DEFAULT_BUDGET_MAPPING,
): Promise<BudgetParse> {
  const sheets = await workbookMatrices(buffer);
  return parseBudgetMatrices(sheets, filename, mapping);
}
