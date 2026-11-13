import { z } from "zod";
import { hashToken } from "@/lib/auth";
import { sql } from "@/lib/db";
import { json, readJson } from "@/lib/http";
import { intakeBudget, intakeOrders, intakeScorecard, rowsToMetrics } from "@/lib/intake";
import { saveBudgetSnapshot, saveMonthly } from "@/lib/apply";
import { describeBudgetUpload } from "@/lib/importers/bva";
import { randomUUID } from "node:crypto";

export const runtime = "nodejs";

const schema = z.object({
  dataset: z.enum(["weekly_scorecard", "monthly_financials", "budget_vs_actual", "notes", "orders", "at_risk"]),
  snapshot: z.unknown().optional(),
  source: z.string().max(200).optional(),
  text: z.string().optional(),
  weekEnding: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  rows: z.array(z.record(z.string(), z.unknown())).max(5000).optional(),
  financials: z
    .object({
      period: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      revenueActual: z.number().nullable().optional(),
      revenueBudget: z.number().nullable().optional(),
      grossMarginActual: z.number().nullable().optional(),
      grossMarginBudget: z.number().nullable().optional(),
      grossMarginAppraisal: z.number().nullable().optional(),
      grossMarginNonAppraisal: z.number().nullable().optional(),
      ebitdaActual: z.number().nullable().optional(),
      ebitdaBudget: z.number().nullable().optional(),
      ebitdaMarginActual: z.number().nullable().optional(),
      ebitdaMarginBudget: z.number().nullable().optional(),
      expensesActual: z.number().nullable().optional(),
      expensesBudget: z.number().nullable().optional(),
    })
    .optional(),
  note: z
    .object({
      whatChanged: z.string().max(5000),
      owner: z.string().max(200),
      nextStep: z.string().max(5000),
    })
    .optional(),
});

async function authorized(req: Request): Promise<boolean> {
  const header = req.headers.get("authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  const rows = await sql<{ id: string }>(
    "SELECT id FROM ingest_tokens WHERE token_hash = $1 AND revoked_at IS NULL",
    [hashToken(token)],
  );
  return rows.length > 0;
}

export async function POST(req: Request) {
  if (!(await authorized(req))) return json({ error: "Unauthorized" }, 401);
  const parsed = schema.safeParse(await readJson(req));
  if (!parsed.success) return json({ error: "Invalid payload." }, 400);
  const body = parsed.data;
  const source = body.source || "ingest";
  try {
    if (body.dataset === "weekly_scorecard") {
      if (body.text) {
        const result = await intakeScorecard({ text: body.text, actor: source, source: "ingest", sourceDetail: source });
        return json(result);
      }
      const metrics = rowsToMetrics(
        (body.rows || []).map((row) => ({
          label: String(row.label || ""),
          section: row.section ? String(row.section) : undefined,
          category: row.category ? String(row.category) : undefined,
          weekEnding: row.weekEnding ? String(row.weekEnding) : body.weekEnding,
          value: row.value == null ? null : String(row.value),
          totalQtd: row.totalQtd == null ? null : String(row.totalQtd),
          avgQtd: row.avgQtd == null ? null : String(row.avgQtd),
          qtdGoal: row.qtdGoal == null ? null : String(row.qtdGoal),
          qtdGoalPct: row.qtdGoalPct == null ? null : String(row.qtdGoalPct),
          wkGoal: row.wkGoal == null ? null : String(row.wkGoal),
        })),
      );
      const result = await intakeScorecard({ metrics, actor: source, source: "ingest", sourceDetail: source });
      return json(result);
    }
    if (body.dataset === "orders") {
      if (!body.text) return json({ error: "orders dataset requires CSV text." }, 400);
      return json(await intakeOrders(body.text, "ingest.csv", source));
    }
    if (body.dataset === "budget_vs_actual") {
      if (!body.snapshot || typeof body.snapshot !== "object") return json({ error: "snapshot object is required." }, 400);
      const described = describeBudgetUpload(body.snapshot);
      const saved = await saveBudgetSnapshot(body.snapshot, { ...described, filename: "ingest.json", actor: source });
      return json({ ok: true, periodEnd: saved.periodEnd });
    }
    if (body.dataset === "monthly_financials") {
      if (!body.financials) return json({ error: "financials object is required." }, 400);
      const f = body.financials;
      await saveMonthly(
        {
          period: f.period,
          revenueActual: f.revenueActual ?? null,
          revenueBudget: f.revenueBudget ?? null,
          grossProfitActual: null,
          grossProfitBudget: null,
          grossMarginActual: f.grossMarginActual ?? null,
          grossMarginBudget: f.grossMarginBudget ?? null,
          grossMarginAppraisal: f.grossMarginAppraisal ?? null,
          grossMarginNonAppraisal: f.grossMarginNonAppraisal ?? null,
          ebitdaActual: f.ebitdaActual ?? null,
          ebitdaBudget: f.ebitdaBudget ?? null,
          ebitdaMarginActual: f.ebitdaMarginActual ?? null,
          ebitdaMarginBudget: f.ebitdaMarginBudget ?? null,
          expensesActual: f.expensesActual ?? null,
          expensesBudget: f.expensesBudget ?? null,
        },
        "ingest",
        source,
      );
      return json({ ok: true });
    }
    if (body.dataset === "notes") {
      if (!body.weekEnding || !body.note) return json({ error: "weekEnding and note are required." }, 400);
      await sql(
        `INSERT INTO notes (id, week_ending, what_changed, owner, next_step, updated_by, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, now())
         ON CONFLICT (week_ending) DO UPDATE SET
           what_changed = EXCLUDED.what_changed,
           owner = EXCLUDED.owner,
           next_step = EXCLUDED.next_step,
           updated_by = EXCLUDED.updated_by,
           updated_at = now()`,
        [randomUUID(), body.weekEnding, body.note.whatChanged, body.note.owner, body.note.nextStep, source],
      );
      return json({ ok: true });
    }
    for (const row of body.rows || []) {
      const name = String(row.clientName || row.client || "").trim();
      if (!name) continue;
      await sql(
        `INSERT INTO at_risk_accounts (id, client_name, tier, reason, annual_value, as_of, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          randomUUID(),
          name,
          row.tier ? String(row.tier) : null,
          row.reason ? String(row.reason) : null,
          row.annualValue == null ? null : Number(row.annualValue),
          body.weekEnding || null,
          source,
        ],
      );
    }
    return json({ ok: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Ingest failed." }, 400);
  }
}
