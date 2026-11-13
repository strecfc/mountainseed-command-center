import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { replaceAugurDeals, saveBudgetSnapshot, upsertMetrics } from "./apply";
import { seedChurnedClients } from "./churned-clients";
import { BVA_RECEIVED_ON, BVA_SOURCE } from "./importers/bva";
import { seedAdminFromEnv } from "./auth";
import { metaGet, metaSet, query } from "./db";
import { parseAugurWorkbook } from "./importers/augur";
import { parseScorecardText } from "./importers/scorecard";
import { DEFAULT_BUDGET_MAPPING, TARGET_DEFS } from "./targets";

export async function seedDatabase(): Promise<void> {
  await seedAdminFromEnv();
  const seeded = await metaGet("seed_version");
  if (seeded !== "2") {
    if (!seeded) await seedReferenceData();
    await seedScorecards();
    await metaSet("seed_version", "2");
  }

  await seedSeptemberBudget();
  await seedChurnedClients();
  await seedSalesforceSnapshot();
}

async function seedReferenceData(): Promise<void> {
  const root = path.join(process.cwd(), "data", "seed");
  const workbook = await parseAugurWorkbook(fs.readFileSync(path.join(root, "augur-uploads-october.xlsx")));
  if (workbook) {
    await replaceAugurDeals(workbook, "augur-uploads-october");
    await query(
      `INSERT INTO uploads (id, kind, filename, status, message)
       VALUES ($1, 'augur', 'Augur Uploads Goal (October) - SC.xlsx', 'seeded', $2)`,
      [randomUUID(), workbook.asOf ? `As of ${workbook.asOf}` : "Augur closed-won workbook seeded."],
    );
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
}

async function seedScorecards(): Promise<void> {
  const root = path.join(process.cwd(), "data", "seed");
  const leadership = parseScorecardText(fs.readFileSync(path.join(root, "scorecard-body-2026-11-10.txt"), "utf8"));
  const marketplace = parseScorecardText(fs.readFileSync(path.join(root, "marketplace-sales-2026-11-10.txt"), "utf8"));
  for (const metric of marketplace.metrics) {
    if (/metric/i.test(metric.section)) metric.section = "MarketPlace";
  }
  await query("DELETE FROM observations WHERE source IN ('leadership-scorecard', 'marketplace-sales-scorecard')");
  await upsertMetrics(
    leadership.metrics,
    "leadership-scorecard",
    "Max DiPlotti leadership Scorecard, received 10 Nov 2026, 4:21 PM ET",
    "2026-11-10T21:21:58Z",
    "2026-11-01",
  );
  const leadershipLabels = new Set(leadership.metrics.map((metric) => metric.label));
  await upsertMetrics(
    marketplace.metrics.filter((metric) => !leadershipLabels.has(metric.label)),
    "marketplace-sales-scorecard",
    "MarketPlace Sales Scorecard, received 10 Nov 2026, 9:43 AM ET",
    "2026-11-10T14:43:22Z",
    "2026-11-01",
  );
  await metaSet("latest_scorecard_week", "2026-11-01");
  await query(
    `INSERT INTO uploads (id, kind, filename, status, message)
     VALUES ($1, 'scorecard', 'Scorecard email 2026-11-10', 'seeded', $2)`,
    [
      randomUUID(),
      "Seeded from the 10 Nov 2026 leadership Scorecard (week ending 1 Nov) and the 10 Nov 2026 MarketPlace Sales Scorecard.",
    ],
  );
}

async function seedSalesforceSnapshot(): Promise<void> {
  if ((await metaGet("salesforce_snapshot")) === "2026-11-13") return;
  const pulledAt = "2026-11-13T15:48:11.632Z";
  const raw = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "seed", "salesforce-2026-11-13.json"), "utf8")) as {
    queries: unknown;
  };
  await query(
    "INSERT INTO salesforce_snapshots (id, pulled_at, status, message, payload) VALUES ($1, $2, 'ok', $3, $4)",
    [randomUUID(), pulledAt, "Salesforce pull completed.", JSON.stringify({ queries: raw.queries })],
  );
  await metaSet("salesforce_snapshot", "2026-11-13");
}

async function seedSeptemberBudget(): Promise<void> {
  const existing = await query<{ id: string }>("SELECT id FROM budget_snapshots WHERE period_end = $1", ["2026-09-30"]);
  if (existing.length) return;
  const raw = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "seed", "finance_bva_2026-09.json"), "utf8")) as unknown;
  await saveBudgetSnapshot(raw, {
    source: BVA_SOURCE,
    receivedOn: BVA_RECEIVED_ON,
    filename: "LT_BvA_Sep2026.xlsx",
    actor: null,
  });
}
