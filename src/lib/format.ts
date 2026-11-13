export type NumberKind = "currency" | "percent" | "number";

export function parseNumeric(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s || s === "—" || s === "-" || s.toLowerCase() === "n/a" || s.toLowerCase() === "null") {
    return null;
  }
  const neg = /^\(.*\)$/.test(s);
  const cleaned = s.replace(/[$,%\s]/g, "").replace(/,/g, "").replace(/[()]/g, "");
  if (!/^[-+]?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

export function detectKind(raw: string | null | undefined): NumberKind {
  if (!raw) return "number";
  if (raw.includes("%")) return "percent";
  if (raw.includes("$")) return "currency";
  return "number";
}

function decimalsIn(sample: string): number {
  const cleaned = sample.replace(/[^0-9.]/g, "");
  const match = cleaned.match(/\.(\d+)/);
  return match ? match[1].length : 0;
}

function trimNum(n: number, decimals: number): string {
  const fixed = n.toFixed(decimals);
  if (decimals === 0) return fixed;
  return fixed.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

export function formatNumber(n: number, kind: NumberKind, sample?: string | null): string {
  const decimals = sample ? decimalsIn(sample) : kind === "percent" ? 1 : kind === "currency" ? 2 : 0;
  const body = trimNum(Math.abs(n), decimals);
  const sign = n < 0 ? "-" : "";
  if (kind === "percent") return `${sign}${body}%`;
  if (kind === "currency") return `${sign}$${body}`;
  return `${sign}${body}`;
}

/** Averages keep enough precision to show they were computed, without inventing extra digits. */
export function formatAverage(n: number, kind: NumberKind, sample?: string | null): string {
  const base = sample ? decimalsIn(sample) : kind === "currency" ? 2 : 1;
  const rounded = Number(n.toFixed(Math.max(base, 2)));
  const body = trimNum(Math.abs(rounded), Math.max(base, 2));
  const sign = rounded < 0 ? "-" : "";
  if (kind === "percent") return `${sign}${body}%`;
  if (kind === "currency") return `${sign}$${body}`;
  return `${sign}${body}`;
}

export function formatUsd(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000 && abs % 1_000_000 === 0) return `${sign}$${abs / 1_000_000}M`;
  return (
    sign +
    abs.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: abs >= 1000 ? 0 : 2,
    })
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatIsoDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  const day = Number(match[3]);
  const month = MONTHS[Number(match[2]) - 1] ?? match[2];
  return `${day} ${month} ${match[1]}`;
}

export function formatTimestamp(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  return fmt.format(d).replace("EST", "ET").replace("EDT", "ET");
}

export function weekLabelToIso(label: string, year = 2026): string | null {
  const trimmed = label.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const named = /^(\d{1,2})[-/ ]([A-Za-z]{3,})$/.exec(trimmed);
  if (!named) return null;
  const idx = MONTHS.findIndex((m) => named[2].toLowerCase().startsWith(m.toLowerCase()));
  if (idx < 0) return null;
  const day = Number(named[1]);
  if (day < 1 || day > 31) return null;
  return `${year}-${String(idx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function isoToWeekLabel(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  const month = MONTHS[Number(match[2]) - 1];
  return `${Number(match[3])}-${month}`;
}

const MONTH_INDEX: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

export function periodFromFilename(filename: string): string | null {
  const match = filename.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\.?\s+(\d{4})\b/i,
  );
  if (!match) return null;
  const month = MONTH_INDEX[match[1].toLowerCase()];
  if (!month) return null;
  return `${match[2]}-${String(month).padStart(2, "0")}-01`;
}

export function emptyToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const s = value.trim();
  if (!s || s === "-" || s === "—" || /^\(blank\b/i.test(s)) return null;
  return s;
}

export function metricKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

export function average(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}
