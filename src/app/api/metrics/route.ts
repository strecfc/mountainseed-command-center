import { loadObservations } from "@/lib/dashboard";
import { json, requireUser } from "@/lib/http";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await requireUser(req);
  if (user instanceof Response) return user;
  const data = await loadObservations();
  return json({
    featuredWeek: data.featuredWeek,
    catalog: data.catalog,
    metrics: [...data.byLabel.entries()].map(([label, rows]) => ({
      label,
      section: rows[0]?.section,
      category: rows[0]?.category,
      rows: rows.map((row) => ({
        periodStart: row.periodStart,
        periodType: row.periodType,
        value: row.valueRaw,
        totalQtd: row.totalRaw,
        avgQtd: row.avgRaw,
        qtdGoal: row.goalRaw,
        wkGoal: row.wkRaw,
        source: row.sourceDetail || row.source,
        updatedAt: row.updatedAt,
      })),
    })),
  });
}
