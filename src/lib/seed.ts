import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { replaceAugurDeals, upsertMetrics } from "./apply";
import { seedAdminFromEnv } from "./auth";
import { metaGet, metaSet, query } from "./db";
import { weekLabelToIso } from "./format";
import { parseAugurWorkbook } from "./importers/augur";
import { parseMarketplaceNotes } from "./importers/scorecard";
import type { ParsedMetric } from "./importers/scorecard";
import { DEFAULT_BUDGET_MAPPING, TARGET_DEFS } from "./targets";

type SummaryMetric = {
  section: string;
  category: string;
  label: string;
  total_qtd: string | null;
  avg_qtd: string | null;
  qtd_goal: string | null;
  qtd_goal_pct: string | null;
  wk_goal: string | null;
  weekly_values?: Record<string, string | null>;
};

type SummaryExtra = {
  label: string;
  total_qtd?: string | null;
  avg_qtd?: string | null;
  qtd_goal?: string | null;
  qtd_goal_pct?: string | null;
  wk_goal?: string | null;
  weekly_values?: Record<string, string | null>;
};

function fromSummary(metric: SummaryMetric, sectionFallback = "MarketPlace", categoryFallback = "Revenue"): ParsedMetric {
  const weekly: Record<string, string | null> = {};
  for (const [label, value] of Object.entries(metric.weekly_values || {})) {
    const iso = weekLabelToIso(label);
    if (!iso || value == null) continue;
    weekly[iso] = value;
  }
  return {
    section: metric.section || sectionFallback,
    category: metric.category || categoryFallback,
    label: metric.label,
    totalQtd: metric.total_qtd ?? null,
    avgQtd: metric.avg_qtd ?? null,
    qtdGoal: metric.qtd_goal ?? null,
    qtdGoalPct: metric.qtd_goal_pct ?? null,
    wkGoal: metric.wk_goal ?? null,
    weekly,
  };
}

export async function seedDatabase(): Promise<void> {
  await seedAdminFromEnv();
  const seeded = await metaGet("seed_version");
  if (seeded === "1") return;

  const root = path.join(process.cwd(), "data", "seed");
  const summary = JSON.parse(fs.readFileSync(path.join(root, "summary.json"), "utf8")) as {
    metrics_on_leadership_scorecard_2026_11_03: SummaryMetric[];
    marketplace_sales_scorecard_extras_relevant: SummaryExtra[];
  };

  const leadership = summary.metrics_on_leadership_scorecard_2026_11_03.map((metric) => fromSummary(metric));
  await upsertMetrics(
    leadership,
    "leadership-scorecard",
    "Max DiPlotti leadership Scorecard, received 3 Nov 2026, 4:22 PM ET",
    "2026-11-03T21:22:32Z",
    "2026-10-25",
  );

  const existing = new Set(leadership.map((metric) => metric.label));
  const extras = summary.marketplace_sales_scorecard_extras_relevant
    .filter((metric) => !existing.has(metric.label))
    .map((metric) =>
      fromSummary({
        section: "MarketPlace",
        category: "Revenue",
        label: metric.label,
        total_qtd: metric.total_qtd ?? null,
        avg_qtd: metric.avg_qtd ?? null,
        qtd_goal: metric.qtd_goal ?? null,
        qtd_goal_pct: metric.qtd_goal_pct ?? null,
        wk_goal: metric.wk_goal ?? null,
        weekly_values: metric.weekly_values,
      }),
    );
  for (const extra of extras) existing.add(extra.label);
  await upsertMetrics(
    extras,
    "marketplace-sales-scorecard",
    "MarketPlace Sales Scorecard, received 27 Oct 2026, 9:20 AM ET",
    "2026-10-27T13:20:00Z",
    "2026-10-18",
  );

  const notes = parseMarketplaceNotes(fs.readFileSync(path.join(root, "marketplace-notes.txt"), "utf8")).filter(
    (metric) => !existing.has(metric.label),
  );
  await upsertMetrics(
    notes,
    "marketplace-sales-scorecard",
    "MarketPlace Sales Scorecard, received 27 Oct 2026, 9:20 AM ET",
    "2026-10-27T13:20:00Z",
    "2026-10-18",
  );

  const workbook = await parseAugurWorkbook(fs.readFileSync(path.join(root, "augur-uploads-october.xlsx")));
  if (workbook) {
    await replaceAugurDeals(workbook, "augur-uploads-october");
  }

  for (const target of TARGET_DEFS) {
    await query(
      `INSERT INTO targets (key, label, value_numeric, unit, notes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (key) DO NOTHING`,
      [target.key, target.label, target.defaultValue, target.unit, target.notes],
    );
  }

  await query(
    `INSERT INTO parser_mappings (id, kind, name, config, active)
     VALUES ($1, 'budget', 'Default budget vs actual', $2, TRUE)`,
    [randomUUID(), JSON.stringify(DEFAULT_BUDGET_MAPPING)],
  );

  await query(
    `INSERT INTO uploads (id, kind, filename, status, message)
     VALUES ($1, 'scorecard', 'Scorecard email 2026-11-03', 'seeded', $2)`,
    [
      randomUUID(),
      "Seeded from the 3 Nov 2026 leadership Scorecard (week ending 25 Oct) and the 27 Oct 2026 MarketPlace Sales Scorecard.",
    ],
  );

  if (workbook) {
    await query(
      `INSERT INTO uploads (id, kind, filename, status, message)
       VALUES ($1, 'augur', 'Augur Uploads Goal (October) - SC.xlsx', 'seeded', $2)`,
      [randomUUID(), workbook.asOf ? `As of ${workbook.asOf}` : "Augur closed-won workbook seeded."],
    );
  }

  await metaSet("latest_scorecard_week", "2026-10-25");
  await metaSet("seed_version", "1");
}
