import { emptyToNull, weekLabelToIso } from "../format";

export type ParsedMetric = {
  section: string;
  category: string;
  label: string;
  totalQtd: string | null;
  avgQtd: string | null;
  qtdGoal: string | null;
  qtdGoalPct: string | null;
  wkGoal: string | null;
  weekly: Record<string, string | null>;
};

export type ParsedScorecard = {
  weeks: string[];
  metrics: ParsedMetric[];
  receivedAt: string | null;
};

const CATEGORY = /^(?:MP\s*-\s*)?(Revenue|Ops|Fin|Technology|Corporate Dev\.?|Operations|Finance)$/i;

export function parseScorecardText(text: string, year = 2026): ParsedScorecard {
  const weekHeader = text.match(/Week columns:\s*(.+)/i);
  const weekLabels = weekHeader
    ? weekHeader[1]
        .split("|")
        .map((part) => part.trim())
        .filter(Boolean)
    : [];
  const weeks = weekLabels.map((label) => weekLabelToIso(label, year) || label);
  const received = text.match(/Received:[^\n]*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)/i);
  let section = "General";
  const metrics: ParsedMetric[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    const sectionMatch = /^===\s*(.+?)\s*===$/.exec(line);
    if (sectionMatch) {
      section = sectionMatch[1].trim();
      continue;
    }
    if (!line.includes("|")) continue;
    if (/^(columns|week columns|source|received|saved|attachment|clarification|subject|to|cc)\b/i.test(line)) {
      continue;
    }
    const parts = line.split("|").map((part) => part.trim());
    if (parts.length < 3) continue;
    if (!CATEGORY.test(parts[0])) continue;
    const label = parts[1];
    if (!label || /^metric$/i.test(label)) continue;
    const rest = parts.slice(2);
    const weekly: Record<string, string | null> = {};
    weeks.forEach((week, index) => {
      weekly[week] = emptyToNull(rest[5 + index]);
    });
    metrics.push({
      section,
      category: normalizeCategory(parts[0]),
      label,
      totalQtd: emptyToNull(rest[0]),
      avgQtd: emptyToNull(rest[1]),
      qtdGoal: emptyToNull(rest[2]),
      qtdGoalPct: emptyToNull(rest[3]),
      wkGoal: emptyToNull(rest[4]),
      weekly,
    });
  }

  return { weeks, metrics, receivedAt: received?.[1] ?? null };
}

function normalizeCategory(value: string): string {
  const trimmed = value.trim().replace(/^MP\s*-\s*/i, "");
  if (/^corporate dev/i.test(trimmed)) return "Corporate Dev.";
  if (/^ops/i.test(trimmed)) return "Ops";
  if (/^fin/i.test(trimmed)) return "Fin";
  if (/^tech/i.test(trimmed)) return "Technology";
  if (/^revenue/i.test(trimmed)) return "Revenue";
  return trimmed;
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
      continue;
    }
    if (char === ",") {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if (char === "\n") {
      row.push(cell.trim());
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    if (char !== "\r") cell += char;
  }
  row.push(cell.trim());
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}

function headerIndex(headers: string[], pattern: RegExp): number {
  return headers.findIndex((header) => pattern.test(header.trim()));
}

export function parseScorecardMatrix(rows: string[][], year = 2026): ParsedScorecard | null {
  if (!rows.length) return null;
  const headerIndexRow = rows.findIndex((row) => {
    const joined = row.join(" ").toLowerCase();
    return /wk goal|qtd goal|week ending|metric/.test(joined) || row.filter((cell) => weekLabelToIso(cell, year)).length >= 2;
  });
  if (headerIndexRow < 0) return null;
  const headers = rows[headerIndexRow].map((cell) => cell.trim());
  const labelCol = headerIndex(headers, /^(metric|label|kpi)$/i);
  const sectionCol = headerIndex(headers, /^section$/i);
  const categoryCol = headerIndex(headers, /^category$/i);
  const totalCol = headerIndex(headers, /^total/);
  const avgCol = headerIndex(headers, /^avg/);
  const goalCol = headers.findIndex((header) => /^qtd goal$/i.test(header.trim()) || /^goal$/i.test(header.trim()));
  const pctCol = headerIndex(headers, /goal %|qtd goal %/i);
  const wkCol = headerIndex(headers, /wk goal|week goal/i);
  const weekCols = headers
    .map((header, index) => ({ index, iso: weekLabelToIso(header, year) }))
    .filter((col) => col.iso);

  const longWeek = headerIndex(headers, /^week ending$/i);
  const valueCol = headerIndex(headers, /^value$/i);
  const metrics: ParsedMetric[] = [];

  if (longWeek >= 0 && valueCol >= 0 && labelCol >= 0) {
    const byLabel = new Map<string, ParsedMetric>();
    for (const row of rows.slice(headerIndexRow + 1)) {
      const label = row[labelCol];
      if (!label) continue;
      const iso = weekLabelToIso(row[longWeek], year);
      let metric = byLabel.get(label);
      if (!metric) {
        metric = {
          section: sectionCol >= 0 ? row[sectionCol] || "General" : "General",
          category: categoryCol >= 0 ? normalizeCategory(row[categoryCol] || "Revenue") : "Revenue",
          label,
          totalQtd: totalCol >= 0 ? emptyToNull(row[totalCol]) : null,
          avgQtd: avgCol >= 0 ? emptyToNull(row[avgCol]) : null,
          qtdGoal: goalCol >= 0 ? emptyToNull(row[goalCol]) : null,
          qtdGoalPct: pctCol >= 0 ? emptyToNull(row[pctCol]) : null,
          wkGoal: wkCol >= 0 ? emptyToNull(row[wkCol]) : null,
          weekly: {},
        };
        byLabel.set(label, metric);
      }
      if (iso) metric.weekly[iso] = emptyToNull(row[valueCol]);
    }
    return { weeks: [], metrics: [...byLabel.values()], receivedAt: null };
  }

  const resolvedLabelCol = labelCol >= 0 ? labelCol : categoryCol >= 0 ? categoryCol + 1 : 1;
  for (const row of rows.slice(headerIndexRow + 1)) {
    const label = row[resolvedLabelCol];
    if (!label || /^metric$/i.test(label)) continue;
    const weekly: Record<string, string | null> = {};
    for (const col of weekCols) weekly[col.iso!] = emptyToNull(row[col.index]);
    if (!label.trim()) continue;
    metrics.push({
      section: sectionCol >= 0 ? row[sectionCol] || inferSection(row) : inferSection(row),
      category: categoryCol >= 0 ? normalizeCategory(row[categoryCol] || "Revenue") : "Revenue",
      label: label.trim(),
      totalQtd: totalCol >= 0 ? emptyToNull(row[totalCol]) : null,
      avgQtd: avgCol >= 0 ? emptyToNull(row[avgCol]) : null,
      qtdGoal: goalCol >= 0 ? emptyToNull(row[goalCol]) : null,
      qtdGoalPct: pctCol >= 0 ? emptyToNull(row[pctCol]) : null,
      wkGoal: wkCol >= 0 ? emptyToNull(row[wkCol]) : null,
      weekly,
    });
  }
  if (!metrics.length) return null;
  return { weeks: weekCols.map((col) => col.iso!), metrics, receivedAt: null };
}

function inferSection(row: string[]): string {
  const first = (row[0] || "").trim();
  if (first && !CATEGORY.test(first) && first.length < 40) return first;
  return "MarketPlace";
}

export function parseScorecardCsv(text: string, year = 2026): ParsedScorecard | null {
  return parseScorecardMatrix(parseCsv(text), year);
}

export type MarketplaceNoteMetric = ParsedMetric & { unlabeledWeeks: string[] | null };

export function parseMarketplaceNotes(text: string, year = 2026, weekColumns: string[] = []): MarketplaceNoteMetric[] {
  const weeks = weekColumns.map((label) => weekLabelToIso(label, year) || label);
  const metrics: MarketplaceNoteMetric[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith("- ")) continue;
    if (/^-\s*(plus |attachments|carl |primary |additional )/i.test(line)) continue;
    const body = line.replace(/^\s*-\s*/, "");
    const parts = body.split("|").map((part) => part.trim());
    const label = parts[0]?.replace(/\s+/g, " ").trim();
    if (!label || label.length < 2) continue;
    let total: string | null = null;
    let avg: string | null = null;
    let goal: string | null = null;
    let pct: string | null = null;
    let wk: string | null = null;
    let unlabeled: string[] | null = null;
    const weekly: Record<string, string | null> = {};
    for (const part of parts.slice(1)) {
      if (!part) continue;
      let match: RegExpExecArray | null;
      if ((match = /^AVG(?:\s+QTD)?\s+(.+)$/i.exec(part))) avg = match[1].trim();
      else if ((match = /^QTD\s+GOAL\s+(.+)$/i.exec(part))) goal = match[1].trim();
      else if ((match = /^WK\s+GOAL\s+(.+)$/i.exec(part))) wk = match[1].trim();
      else if ((match = /^GOAL\s+(.+)$/i.exec(part))) goal = match[1].trim();
      else if ((match = /^Total\s+(.+)$/i.exec(part))) total = match[1].trim();
      else if ((match = /^weeks?:\s*(.+)$/i.exec(part))) unlabeled = splitList(match[1]);
      else if (part.includes(",") && /^[\d.,$%\s-]+$/.test(part)) unlabeled = splitList(part);
      else if (/^\d+(\.\d+)?%$/.test(part) && (total || avg || goal)) pct = part;
      else if (/^\$?[\d,.]+%?$/.test(part) && !total && !avg) total = part;
    }
    if (unlabeled && weeks.length) {
      weeks.forEach((week, index) => {
        weekly[week] = unlabeled?.[index] ?? null;
      });
      unlabeled = null;
    }
    if (!total && !avg && !goal && !unlabeled && !Object.keys(weekly).length) continue;
    metrics.push({
      section: "MarketPlace",
      category: /churn|retention|orders/i.test(label) ? "Revenue" : "Revenue",
      label,
      totalQtd: total,
      avgQtd: avg,
      qtdGoal: goal,
      qtdGoalPct: pct,
      wkGoal: wk,
      weekly,
      unlabeledWeeks: unlabeled,
    });
  }
  return metrics;
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}
