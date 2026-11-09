import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseBudgetSnapshot, presentBudget, BVA_RECEIVED_ON, BVA_SOURCE } from "@/lib/importers/bva";

const snapshot = parseBudgetSnapshot(
  JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "seed", "finance_bva_2026-09.json"), "utf8")),
);
const board = presentBudget(snapshot, BVA_RECEIVED_ON, BVA_SOURCE);

describe("September 2026 budget vs actual", () => {
  it("uses the P&L year-to-date and September margins, rounded the way the scoreboard shows them", () => {
    expect(snapshot.periodEnd).toBe("2026-09-30");
    expect(board.scoreboard.ytdMargin).toBe("23.3%");
    expect(board.scoreboard.ytdBudget).toBe("24.7%");
    expect(board.scoreboard.septemberMargin).toBe("28.4%");
    expect(board.scoreboard.septemberBudget).toBe("30.6%");
    expect(board.rows.find((row) => row.label === "Reported EBITDA margin")?.septemberBudget).toBe("30.65%");
    expect(board.scoreboard.ytdGrossMargin).toBe("68.1%");
    expect(board.rows.find((row) => row.label === "Reported EBITDA margin")?.ytdActual).toBe("23.34%");
    expect(board.rows.find((row) => row.label === "Reported EBITDA")?.ytdVariance.startsWith("-$851,281.87")).toBe(true);
    expect(board.rows.map((row) => row.label).join(" ")).not.toMatch(/adjusted/i);
  });

  it("keeps Q2 EBITDA from the P&L quarter, not the sum of the Q2 tab months", () => {
    const months = snapshot.monthly.filter((month) => ["2026-04", "2026-05", "2026-06"].includes(month.month));
    const summed = months.reduce((total, month) => total + (month.lines.ebitda?.actual || 0), 0);
    expect(snapshot.quarters.q2.ebitda?.actual).toBeCloseTo(1485680.05, 2);
    expect(summed).not.toBeCloseTo(snapshot.quarters.q2.ebitda?.actual || 0, 0);
    expect(board.q2Note).toContain("$1,485,680.05");
    expect(board.ebitdaTrend.filter((point) => point.stale).map((point) => point.label)).toEqual(["Apr", "May", "Jun"]);
  });

  it("treats year-to-date budget as Q1 + Q2 + Q3", () => {
    const quarters = [snapshot.quarters.q1, snapshot.quarters.q2, snapshot.quarters.q3];
    const budget = quarters.reduce((total, quarter) => total + (quarter.total_revenue?.budget || 0), 0);
    expect(budget).toBeCloseTo(snapshot.ytd.total_revenue?.budget || 0, 2);
    expect(board.ytdBudgetNote).toMatch(/Q1 \+ Q2 \+ Q3/);
    expect(board.rows.find((row) => row.label === "Total revenue")?.fyBudget).toBe("$30,661,707.65");
  });
});
