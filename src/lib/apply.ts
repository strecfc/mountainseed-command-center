import { randomUUID } from "node:crypto";
import { metaSet, query } from "./db";
import { metricKey, parseNumeric } from "./format";
import type { AugurWorkbook } from "./importers/augur";
import { parseBudgetSnapshot, type MoneyCell } from "./importers/bva";
import type { MonthlyActuals } from "./importers/budget";
import type { OrderLine } from "./importers/orders";
import type { ParsedMetric } from "./importers/scorecard";
import { directionFor } from "./status";

export async function upsertMetrics(
  metrics: ParsedMetric[],
  source: string,
  sourceDetail: string,
  updatedAt: string,
  snapshotDate: string,
): Promise<number> {
  let written = 0;
  let sort = 0;
  const weekDates: string[] = [];
  for (const metric of metrics) {
    sort += 1;
    const key = metricKey(metric.label);
    await query(
      `INSERT INTO metric_definitions (key, label, section, category, direction, cadence, source, sort_order)
       VALUES ($1, $2, $3, $4, $5, 'weekly', $6, $7)
       ON CONFLICT (key) DO UPDATE SET
         label = EXCLUDED.label,
         section = EXCLUDED.section,
         category = EXCLUDED.category,
         direction = EXCLUDED.direction,
         source = EXCLUDED.source`,
      [key, metric.label, metric.section, metric.category, directionFor(metric.label), source, sort],
    );
    const weeks = Object.entries(metric.weekly).filter(([, raw]) => raw != null);
    const base = [
      metric.totalQtd,
      parseNumeric(metric.totalQtd),
      metric.avgQtd,
      parseNumeric(metric.avgQtd),
      metric.qtdGoal,
      parseNumeric(metric.qtdGoal),
      metric.qtdGoalPct,
      metric.wkGoal,
      parseNumeric(metric.wkGoal),
      source,
      sourceDetail,
      updatedAt,
    ];
    if (!weeks.length) {
      const headline = metric.totalQtd ?? metric.avgQtd;
      await query(
        `INSERT INTO observations (
           id, metric_key, period_start, period_type, value_raw, value_numeric,
           total_qtd_raw, total_qtd_numeric, avg_qtd_raw, avg_qtd_numeric,
           qtd_goal_raw, qtd_goal_numeric, qtd_goal_pct_raw, wk_goal_raw, wk_goal_numeric,
           source, source_detail, updated_at
         ) VALUES (
           $1, $2, $3, 'snapshot', $4, $5,
           $6, $7, $8, $9,
           $10, $11, $12, $13, $14,
           $15, $16, $17
         )
         ON CONFLICT (metric_key, period_type, period_start) DO UPDATE SET
           value_raw = EXCLUDED.value_raw,
           value_numeric = EXCLUDED.value_numeric,
           total_qtd_raw = EXCLUDED.total_qtd_raw,
           total_qtd_numeric = EXCLUDED.total_qtd_numeric,
           avg_qtd_raw = EXCLUDED.avg_qtd_raw,
           avg_qtd_numeric = EXCLUDED.avg_qtd_numeric,
           qtd_goal_raw = EXCLUDED.qtd_goal_raw,
           qtd_goal_numeric = EXCLUDED.qtd_goal_numeric,
           qtd_goal_pct_raw = EXCLUDED.qtd_goal_pct_raw,
           wk_goal_raw = EXCLUDED.wk_goal_raw,
           wk_goal_numeric = EXCLUDED.wk_goal_numeric,
           source = EXCLUDED.source,
           source_detail = EXCLUDED.source_detail,
           updated_at = EXCLUDED.updated_at`,
        [randomUUID(), key, snapshotDate, headline, parseNumeric(headline), ...base],
      );
      written += 1;
      continue;
    }
    for (const [iso, raw] of weeks) {
      weekDates.push(iso);
      await query(
        `INSERT INTO observations (
           id, metric_key, period_start, period_type, value_raw, value_numeric,
           total_qtd_raw, total_qtd_numeric, avg_qtd_raw, avg_qtd_numeric,
           qtd_goal_raw, qtd_goal_numeric, qtd_goal_pct_raw, wk_goal_raw, wk_goal_numeric,
           source, source_detail, updated_at
         ) VALUES (
           $1, $2, $3, 'week', $4, $5,
           $6, $7, $8, $9,
           $10, $11, $12, $13, $14,
           $15, $16, $17
         )
         ON CONFLICT (metric_key, period_type, period_start) DO UPDATE SET
           value_raw = EXCLUDED.value_raw,
           value_numeric = EXCLUDED.value_numeric,
           total_qtd_raw = EXCLUDED.total_qtd_raw,
           total_qtd_numeric = EXCLUDED.total_qtd_numeric,
           avg_qtd_raw = EXCLUDED.avg_qtd_raw,
           avg_qtd_numeric = EXCLUDED.avg_qtd_numeric,
           qtd_goal_raw = EXCLUDED.qtd_goal_raw,
           qtd_goal_numeric = EXCLUDED.qtd_goal_numeric,
           qtd_goal_pct_raw = EXCLUDED.qtd_goal_pct_raw,
           wk_goal_raw = EXCLUDED.wk_goal_raw,
           wk_goal_numeric = EXCLUDED.wk_goal_numeric,
           source = EXCLUDED.source,
           source_detail = EXCLUDED.source_detail,
           updated_at = EXCLUDED.updated_at`,
        [randomUUID(), key, iso, raw, parseNumeric(raw), ...base],
      );
      written += 1;
    }
  }
  if (weekDates.length) {
    const latest = weekDates.sort().at(-1)!;
    const current = await query<{ value: string }>("SELECT value FROM app_meta WHERE key = 'latest_scorecard_week'");
    if (!current[0] || current[0].value < latest) {
      await metaSet("latest_scorecard_week", latest);
    }
  }
  return written;
}

export async function replaceAugurDeals(workbook: AugurWorkbook, source: string): Promise<void> {
  await query("DELETE FROM augur_deals WHERE source = $1", [source]);
  const meta = JSON.stringify({
    annualVolumePreOctober: workbook.annualVolumePreOctober,
    weeklyGoalTotal: workbook.weeklyGoalTotal,
    uploadsTotal: workbook.uploadsTotal,
    weekOf: workbook.weekOf,
    generatedBy: workbook.generatedBy,
  });
  for (const deal of workbook.deals) {
    await query(
      `INSERT INTO augur_deals (
         id, opportunity_name, amount, age, close_date, expected_monthly_appraisals,
         weekly_goal, actual_uploads, diff, source, as_of, workbook_meta
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        randomUUID(),
        deal.opportunityName,
        deal.amount,
        deal.age,
        deal.closeDate,
        deal.expectedMonthlyAppraisals,
        deal.weeklyGoal,
        deal.actualUploads,
        deal.diff,
        source,
        workbook.asOf,
        meta,
      ],
    );
  }
}

export async function saveMonthly(record: MonthlyActuals, source: string, filename: string): Promise<void> {
  await query(
    `INSERT INTO monthly_financials (
       id, period, revenue_actual, revenue_budget, gross_profit_actual, gross_profit_budget,
       gross_margin_actual, gross_margin_budget, gross_margin_appraisal, gross_margin_non_appraisal,
       ebitda_actual, ebitda_budget, ebitda_margin_actual, ebitda_margin_budget,
       expenses_actual, expenses_budget, source, filename
     ) VALUES (
       $1, $2, $3, $4, $5, $6,
       $7, $8, $9, $10,
       $11, $12, $13, $14,
       $15, $16, $17, $18
     )
     ON CONFLICT (period) DO UPDATE SET
       revenue_actual = EXCLUDED.revenue_actual,
       revenue_budget = EXCLUDED.revenue_budget,
       gross_profit_actual = EXCLUDED.gross_profit_actual,
       gross_profit_budget = EXCLUDED.gross_profit_budget,
       gross_margin_actual = EXCLUDED.gross_margin_actual,
       gross_margin_budget = EXCLUDED.gross_margin_budget,
       gross_margin_appraisal = EXCLUDED.gross_margin_appraisal,
       gross_margin_non_appraisal = EXCLUDED.gross_margin_non_appraisal,
       ebitda_actual = EXCLUDED.ebitda_actual,
       ebitda_budget = EXCLUDED.ebitda_budget,
       ebitda_margin_actual = EXCLUDED.ebitda_margin_actual,
       ebitda_margin_budget = EXCLUDED.ebitda_margin_budget,
       expenses_actual = EXCLUDED.expenses_actual,
       expenses_budget = EXCLUDED.expenses_budget,
       source = EXCLUDED.source,
       filename = EXCLUDED.filename,
       updated_at = now()`,
    [
      randomUUID(),
      record.period,
      record.revenueActual,
      record.revenueBudget,
      record.grossProfitActual,
      record.grossProfitBudget,
      record.grossMarginActual,
      record.grossMarginBudget,
      record.grossMarginAppraisal,
      record.grossMarginNonAppraisal,
      record.ebitdaActual,
      record.ebitdaBudget,
      record.ebitdaMarginActual,
      record.ebitdaMarginBudget,
      record.expensesActual,
      record.expensesBudget,
      source,
      filename,
    ],
  );
}

export async function replaceOrders(lines: OrderLine[], filename: string, uploadedBy: string | null): Promise<number> {
  await query("DELETE FROM order_rows");
  const fileId = randomUUID();
  await query(
    "INSERT INTO order_files (id, filename, uploaded_by, row_count) VALUES ($1, $2, $3, $4)",
    [fileId, filename, uploadedBy, lines.length],
  );
  for (const line of lines) {
    await query(
      `INSERT INTO order_rows (
         id, file_id, client_name, order_date, completed_date, appraiser_type,
         fee, cost, turn_time_bd, revised, late, product, source
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'valuetrac')`,
      [
        randomUUID(),
        fileId,
        line.clientName,
        line.orderDate,
        line.completedDate,
        line.appraiserType,
        line.fee,
        line.cost,
        line.turnTimeBd,
        line.revised,
        line.late,
        line.product,
      ],
    );
  }
  return lines.length;
}

function percentPoints(cell: MoneyCell | undefined, field: "actual" | "budget"): number | null {
  const value = cell?.[field];
  return value == null ? null : value * 100;
}

export async function saveBudgetSnapshot(
  raw: unknown,
  meta: { source: string; receivedOn: string; filename?: string; actor?: string | null },
): Promise<{ periodEnd: string }> {
  const snapshot = parseBudgetSnapshot(raw);
  const filename = meta.filename || snapshot.filename;
  await query(
    `INSERT INTO budget_snapshots (id, period_end, received_on, source, filename, payload)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (period_end) DO UPDATE SET
       received_on = EXCLUDED.received_on,
       source = EXCLUDED.source,
       filename = EXCLUDED.filename,
       payload = EXCLUDED.payload,
       created_at = now()`,
    [randomUUID(), snapshot.periodEnd, meta.receivedOn, meta.source, filename, JSON.stringify(raw)],
  );
  for (const month of snapshot.monthly) {
    if (!/^\d{4}-\d{2}$/.test(month.month)) continue;
    const lines = month.lines;
    await saveMonthly(
      {
        period: `${month.month}-01`,
        revenueActual: lines.total_revenue?.actual ?? null,
        revenueBudget: lines.total_revenue?.budget ?? null,
        grossProfitActual: lines.gross_profit?.actual ?? null,
        grossProfitBudget: lines.gross_profit?.budget ?? null,
        grossMarginActual: percentPoints(lines.gross_margin, "actual"),
        grossMarginBudget: percentPoints(lines.gross_margin, "budget"),
        grossMarginAppraisal: null,
        grossMarginNonAppraisal: null,
        ebitdaActual: lines.ebitda?.actual ?? null,
        ebitdaBudget: lines.ebitda?.budget ?? null,
        ebitdaMarginActual: percentPoints(lines.ebitda_margin, "actual"),
        ebitdaMarginBudget: percentPoints(lines.ebitda_margin, "budget"),
        expensesActual: lines.total_operating_expenses?.actual ?? null,
        expensesBudget: lines.total_operating_expenses?.budget ?? null,
      },
      `bva:${snapshot.periodEnd}`,
      filename,
    );
  }
  await recordUpload(
    "budget",
    filename,
    meta.actor ?? null,
    "saved",
    `Budget vs actual through ${snapshot.periodEnd}. Reported EBITDA. YTD budget is Q1+Q2+Q3.`,
  );
  return { periodEnd: snapshot.periodEnd };
}

export async function recordUpload(
  kind: string,
  filename: string | null,
  uploadedBy: string | null,
  status: string,
  message: string,
): Promise<void> {
  await query(
    "INSERT INTO uploads (id, kind, filename, uploaded_by, status, message) VALUES ($1, $2, $3, $4, $5, $6)",
    [randomUUID(), kind, filename, uploadedBy, status, message],
  );
}
