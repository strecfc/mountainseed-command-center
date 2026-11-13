import { parseNumeric } from "../format";
import { parseCsv } from "./scorecard";

export type OrderLine = {
  clientName: string | null;
  orderDate: string | null;
  completedDate: string | null;
  appraiserType: "cra" | "fee" | "unknown";
  fee: number | null;
  cost: number | null;
  turnTimeBd: number | null;
  revised: boolean | null;
  late: boolean | null;
  product: string | null;
};

export type OrderSummary = {
  cra: ChannelStats;
  fee: ChannelStats;
  unknownFiles: number;
  craShare: number | null;
  repeatPaidClients: number | null;
  clientsWithSecondService: number | null;
  earlyWarnings: { client: string; baselineWeekly: number; recent: number; dropPct: number }[];
};

export type ChannelStats = {
  files: number;
  avgFee: number | null;
  avgCost: number | null;
  avgMargin: number | null;
  avgTurn: number | null;
  revisionRate: number | null;
};

function headerMap(headers: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  headers.forEach((header, index) => {
    map[header.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()] = index;
  });
  return map;
}

function pick(map: Record<string, number>, row: string[], names: string[]): string {
  for (const name of names) {
    if (map[name] != null && row[map[name]]) return row[map[name]].trim();
  }
  for (const [key, index] of Object.entries(map)) {
    if (names.some((name) => key.includes(name)) && row[index]) return row[index].trim();
  }
  return "";
}

function truthy(value: string): boolean | null {
  if (!value) return null;
  if (/^(y|yes|true|1|revised|late)$/i.test(value)) return true;
  if (/^(n|no|false|0)$/i.test(value)) return false;
  return null;
}

function classify(explicit: string, appraiser: string): "cra" | "fee" | "unknown" {
  const blob = `${explicit} ${appraiser}`.toLowerCase();
  if (!blob.trim()) return "unknown";
  if (/\bcra\b|collateral risk/.test(blob)) return "cra";
  if (/\bfee\b|regular|panel appraiser|vendor/.test(blob)) return "fee";
  if (explicit) return "unknown";
  return "unknown";
}

function isoDate(value: string): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(value);
  if (!match) return null;
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
}

export function parseOrderCsv(text: string): OrderLine[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const map = headerMap(rows[0]);
  const lines: OrderLine[] = [];
  for (const row of rows.slice(1)) {
    if (row.every((cell) => !cell.trim())) continue;
    const explicit = pick(map, row, ["appraiser type", "panel type", "type"]);
    const appraiser = pick(map, row, ["appraiser", "appraiser name", "vendor"]);
    lines.push({
      clientName: pick(map, row, ["client", "client name", "bank"]) || null,
      orderDate: isoDate(pick(map, row, ["order date", "ordered", "date ordered"])),
      completedDate: isoDate(pick(map, row, ["completed date", "complete date", "delivered", "date completed"])),
      appraiserType: classify(explicit, appraiser),
      fee: parseNumeric(pick(map, row, ["fee", "client fee", "revenue"])),
      cost: parseNumeric(pick(map, row, ["cost", "appraiser cost", "appraiser fee"])),
      turnTimeBd: parseNumeric(pick(map, row, ["turn time bd", "turn time", "turn days", "business days"])),
      revised: truthy(pick(map, row, ["revision", "revised"])),
      late: truthy(pick(map, row, ["late"])),
      product: pick(map, row, ["product", "service", "product type"]) || null,
    });
  }
  return lines;
}

function mean(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

function channel(lines: OrderLine[]): ChannelStats {
  const fees = lines.map((line) => line.fee).filter((n): n is number => n != null);
  const costs = lines.map((line) => line.cost).filter((n): n is number => n != null);
  const margins = lines
    .filter((line) => line.fee != null && line.cost != null)
    .map((line) => (line.fee as number) - (line.cost as number));
  const turns = lines.map((line) => line.turnTimeBd).filter((n): n is number => n != null);
  const revisions = lines.filter((line) => line.revised != null);
  return {
    files: lines.length,
    avgFee: mean(fees),
    avgCost: mean(costs),
    avgMargin: mean(margins),
    avgTurn: mean(turns),
    revisionRate: revisions.length ? (revisions.filter((line) => line.revised).length / revisions.length) * 100 : null,
  };
}

export function summarizeOrders(lines: OrderLine[], asOf = new Date()): OrderSummary {
  const cra = channel(lines.filter((line) => line.appraiserType === "cra"));
  const fee = channel(lines.filter((line) => line.appraiserType === "fee"));
  const known = cra.files + fee.files;
  const byClient = new Map<string, OrderLine[]>();
  for (const line of lines) {
    if (!line.clientName) continue;
    const list = byClient.get(line.clientName) || [];
    list.push(line);
    byClient.set(line.clientName, list);
  }
  let repeatPaidClients = 0;
  let clientsWithSecondService = 0;
  let serviceKnown = false;
  for (const group of byClient.values()) {
    const paid = group.filter((line) => (line.fee || 0) > 0 || line.completedDate);
    if (paid.length >= 2) repeatPaidClients += 1;
    const products = new Set(group.map((line) => line.product).filter(Boolean));
    if (products.size > 0) serviceKnown = true;
    if (products.size >= 2) clientsWithSecondService += 1;
  }

  const asOfMs = asOf.getTime();
  const day = 86_400_000;
  const earlyWarnings: OrderSummary["earlyWarnings"] = [];
  for (const [client, group] of byClient) {
    const dates = group
      .map((line) => line.completedDate || line.orderDate)
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(`${value}T00:00:00Z`).getTime());
    if (dates.length < 2) continue;
    const recent = dates.filter((time) => time <= asOfMs && time > asOfMs - 7 * day).length;
    const baselineCount = dates.filter((time) => time <= asOfMs - 7 * day && time > asOfMs - 97 * day).length;
    const baselineWeekly = baselineCount / (90 / 7);
    if (baselineWeekly <= 0) continue;
    if (recent < baselineWeekly * 0.8) {
      earlyWarnings.push({
        client,
        baselineWeekly,
        recent,
        dropPct: ((baselineWeekly - recent) / baselineWeekly) * 100,
      });
    }
  }
  earlyWarnings.sort((a, b) => b.dropPct - a.dropPct);

  return {
    cra,
    fee,
    unknownFiles: lines.filter((line) => line.appraiserType === "unknown").length,
    craShare: known ? (cra.files / known) * 100 : null,
    repeatPaidClients: lines.length ? repeatPaidClients : null,
    clientsWithSecondService: serviceKnown ? clientsWithSecondService : null,
    earlyWarnings,
  };
}
