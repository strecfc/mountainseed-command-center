import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { weekLabelToIso } from "@/lib/format";
import { parseAugurWorkbook } from "@/lib/importers/augur";
import { parseBudgetWorkbook } from "@/lib/importers/budget";
import { parseOrderCsv, summarizeOrders } from "@/lib/importers/orders";
import { parseMarketplaceNotes, parseScorecardCsv, parseScorecardText } from "@/lib/importers/scorecard";
import { rate } from "@/lib/status";
import { pullSalesforce, salesforceConfig, salesforceQueries } from "@/lib/salesforce";

const seedDir = path.join(process.cwd(), "data", "seed");

describe("leadership scorecard importer", () => {
  const parsed = parseScorecardText(fs.readFileSync(path.join(seedDir, "scorecard-body.txt"), "utf8"));
  const summary = JSON.parse(fs.readFileSync(path.join(seedDir, "summary.json"), "utf8")) as {
    metrics_on_leadership_scorecard_2026_11_03: {
      label: string;
      section: string;
      total_qtd: string | null;
      avg_qtd: string | null;
      qtd_goal: string | null;
      qtd_goal_pct: string | null;
      wk_goal: string | null;
      weekly_values: Record<string, string | null>;
    }[];
  };

  it("matches every metric, goal, and week on the 3 Nov 2026 scorecard", () => {
    expect(parsed.metrics).toHaveLength(summary.metrics_on_leadership_scorecard_2026_11_03.length);
    expect(parsed.receivedAt).toBe("2026-11-03T21:22:32Z");
    for (const source of summary.metrics_on_leadership_scorecard_2026_11_03) {
      const metric = parsed.metrics.find((item) => item.label === source.label);
      expect(metric, source.label).toBeTruthy();
      expect(metric?.section).toBe(source.section);
      expect(metric?.totalQtd).toBe(source.total_qtd);
      expect(metric?.avgQtd).toBe(source.avg_qtd);
      expect(metric?.qtdGoal).toBe(source.qtd_goal);
      expect(metric?.qtdGoalPct).toBe(source.qtd_goal_pct);
      expect(metric?.wkGoal).toBe(source.wk_goal);
      for (const [week, value] of Object.entries(source.weekly_values)) {
        expect(metric?.weekly[weekLabelToIso(week) || ""]).toBe(value);
      }
    }
  });

  it("keeps blanks empty instead of turning them into zeros", () => {
    const expense = parsed.metrics.find((metric) => metric.label === "Expense Budget to Actual %");
    expect(expense?.weekly["2026-10-25"]).toBeNull();
    expect(expense?.weekly["2026-09-27"]).toBe("92%");
    expect(expense?.avgQtd).toBe("92%");
  });
});

describe("marketplace notes importer", () => {
  const metrics = parseMarketplaceNotes(fs.readFileSync(path.join(seedDir, "marketplace-notes.txt"), "utf8"));

  it("reads the sales figures that are actually in the note", () => {
    const sdr = metrics.find((metric) => metric.label === "SDR Closed Won $ (Thousands)");
    expect(sdr?.totalQtd).toBe("$125");
    expect(sdr?.qtdGoal).toBe("$115");
    expect(sdr?.qtdGoalPct).toBe("108%");
    const quiet = metrics.find((metric) => metric.label.startsWith("# of Clients > $5k"));
    expect(quiet?.avgQtd).toBe("1");
    expect(quiet?.qtdGoal).toBe("5");
    expect(quiet?.unlabeledWeeks).toBeNull();
    const meetings = metrics.find((metric) => metric.label === "AMC Weekly Meetings Set - New Meetings");
    expect(meetings?.totalQtd).toBe("65");
    expect(meetings?.wkGoal).toBe("17");
    expect(meetings?.unlabeledWeeks).toEqual(["17", "14", "27", "7"]);
  });
});

describe("budget and order importers", () => {
  it("parses a budget workbook by row label and filename month", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("P&L");
    sheet.addRow(["Line", "Budget", "Actual"]);
    sheet.addRow(["Total Revenue", 4000000, 3800000]);
    sheet.addRow(["Gross Margin", 0.695, 0.681]);
    sheet.addRow(["Appraisal Gross Margin", 0.71, 0.7]);
    sheet.addRow(["Non-Appraisal Gross Margin", 0.55, 0.5]);
    sheet.addRow(["EBITDA", 1400000, 900000]);
    sheet.addRow(["EBITDA Margin", 0.35, 0.22]);
    sheet.addRow(["Total Expenses", 2200000, 2100000]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const parsed = await parseBudgetWorkbook(buffer, "LT Budget vs Actual October 2026.xlsx");
    expect(parsed.periods).toHaveLength(1);
    const month = parsed.periods[0];
    expect(month.period).toBe("2026-10-01");
    expect(month.revenueActual).toBe(3800000);
    expect(month.revenueBudget).toBe(4000000);
    expect(month.grossMarginActual).toBeCloseTo(68.1);
    expect(month.grossMarginAppraisal).toBeCloseTo(70);
    expect(month.grossMarginNonAppraisal).toBeCloseTo(50);
    expect(month.ebitdaActual).toBe(900000);
    expect(month.ebitdaMarginActual).toBeCloseTo(22);
    expect(month.expensesActual).toBe(2100000);
  });

  it("parses a wide scorecard csv", () => {
    const csv = [
      "section,category,label,Total QTD,AVG QTD,QTD GOAL,QTD Goal %,WK GOAL,25-Oct,18-Oct",
      "MarketPlace,Revenue,Sample metric,10,9,12,83%,12,8,11",
    ].join("\n");
    const parsed = parseScorecardCsv(csv);
    expect(parsed?.metrics[0].label).toBe("Sample metric");
    expect(parsed?.metrics[0].weekly["2026-10-25"]).toBe("8");
    expect(parsed?.metrics[0].qtdGoal).toBe("12");
  });

  it("splits CRA and fee files and flags a 20% order drop", () => {
    const csv = [
      "Client,Completed Date,Appraiser Type,Fee,Cost,Turn Time BD,Revision,Product",
      "Bank A,2026-08-01,CRA,2500,800,4,No,Appraisal",
      "Bank A,2026-08-08,CRA,2500,800,4,No,Appraisal",
      "Bank A,2026-08-15,CRA,2500,800,5,Yes,Appraisal",
      "Bank A,2026-08-22,CRA,2500,900,4,No,Evaluation",
      "Bank A,2026-09-05,CRA,2400,800,4,No,Appraisal",
      "Bank B,2026-10-20,Fee,2000,1200,8,Yes,Appraisal",
    ].join("\n");
    const lines = parseOrderCsv(csv);
    expect(lines.filter((line) => line.appraiserType === "cra")).toHaveLength(5);
    expect(lines.filter((line) => line.appraiserType === "fee")).toHaveLength(1);
    const summary = summarizeOrders(lines, new Date("2026-10-20T00:00:00Z"));
    expect(summary.cra.files).toBe(5);
    expect(summary.fee.avgFee).toBe(2000);
    expect(summary.clientsWithSecondService).toBe(1);
    expect(summary.repeatPaidClients).toBe(1);
    expect(summary.earlyWarnings.map((item) => item.client)).toContain("Bank A");
  });
});

describe("augur workbook", () => {
  it("reads the October closed-won sheet without inventing amounts", async () => {
    const workbook = await parseAugurWorkbook(fs.readFileSync(path.join(seedDir, "augur-uploads-october.xlsx")));
    expect(workbook).toBeTruthy();
    const gulf = workbook?.deals.find((deal) => deal.opportunityName.startsWith("Gulf Coast Bank"));
    expect(gulf?.amount).toBe(36000);
    expect(gulf?.expectedMonthlyAppraisals).toBe(45);
    expect(workbook?.deals.some((deal) => deal.opportunityName === "First Citizens")).toBe(true);
    expect(workbook?.uploadsTotal).toBe(100);
    expect(workbook?.weeklyGoalTotal).toBeCloseTo(261.23, 1);
  });
});

describe("status and salesforce gate", () => {
  it("colors lower-is-better ceilings correctly", () => {
    expect(rate(9.02, 10, "lower")).toBe("green");
    expect(rate(20, 12, "lower")).toBe("red");
    expect(rate(103.72, 105.14, "higher")).toBe("yellow");
    expect(rate(167, 100, "higher")).toBe("green");
    expect(rate(null, 35, "higher")).toBe("none");
  });

  it("does not call Salesforce when credentials are absent", async () => {
    expect(salesforceConfig()).toBeNull();
    const calls: string[] = [];
    const original = global.fetch;
    global.fetch = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response("no", { status: 500 });
    }) as typeof fetch;
    const result = await pullSalesforce();
    global.fetch = original;
    expect(result.status).toBe("not_connected");
    expect(calls).toHaveLength(0);
  });

  it("uses client credentials on the My Domain URL, and password only when a user is set", async () => {
    const previous = {
      SF_LOGIN_URL: process.env.SF_LOGIN_URL,
      SF_CLIENT_ID: process.env.SF_CLIENT_ID,
      SF_CLIENT_SECRET: process.env.SF_CLIENT_SECRET,
      SF_USERNAME: process.env.SF_USERNAME,
      SF_PASSWORD: process.env.SF_PASSWORD,
    };
    const restore = () => {
      for (const [key, value] of Object.entries(previous)) {
        if (value == null) delete process.env[key];
        else process.env[key] = value;
      }
    };
    const bodies: string[] = [];
    const original = global.fetch;
    global.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      bodies.push(String(init?.body || ""));
      return new Response(JSON.stringify({ error_description: "rejected" }), { status: 400 });
    }) as typeof fetch;
    try {
      process.env.SF_LOGIN_URL = "https://mountainseed.my.salesforce.com";
      process.env.SF_CLIENT_ID = "client-id";
      process.env.SF_CLIENT_SECRET = "client-secret";
      delete process.env.SF_USERNAME;
      delete process.env.SF_PASSWORD;
      expect(salesforceConfig()?.grantType).toBe("client_credentials");
      await pullSalesforce();
      expect(bodies.at(-1)).toContain("grant_type=client_credentials");
      expect(bodies.at(-1)).not.toContain("username=");

      process.env.SF_USERNAME = "integration@mountainseed.com";
      process.env.SF_PASSWORD = "secret-password";
      expect(salesforceConfig()?.grantType).toBe("password");
      await pullSalesforce();
      expect(bodies.at(-1)).toContain("grant_type=password");
      expect(bodies.at(-1)).toContain("username=integration%40mountainseed.com");
    } finally {
      global.fetch = original;
      restore();
    }
  });

  it("queries M&As and churn subjects, both overridable", () => {
    const queries = salesforceQueries();
    expect(queries.ma_stages).toContain("RecordType.Name = 'M&As'");
    expect(queries.churn_cases).toBe("SELECT COUNT(Id) n FROM Case WHERE IsClosed = false AND Subject LIKE '%churn%'");
    process.env.SF_SOQL_JSON = JSON.stringify({ churn_cases: "SELECT COUNT(Id) n FROM Case WHERE IsClosed = false AND Type = 'Custom'" });
    expect(salesforceQueries().churn_cases).toContain("Type = 'Custom'");
    expect(salesforceQueries().ma_stages).toContain("'M&As'");
    delete process.env.SF_SOQL_JSON;
  });
});
