import { randomUUID } from "node:crypto";
import { metaSet, query } from "./db";
import { metricKey, parseNumeric } from "./format";
import type { AugurWorkbook } from "./importers/augur";
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
