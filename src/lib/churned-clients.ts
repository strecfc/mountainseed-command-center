import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { query, sql } from "./db";
import { formatIsoDate } from "./format";

export type ChurnedClient = {
  name: string;
  closedOn: string | null;
  lastOrderOn: string | null;
  daysSinceLastOrder: number | null;
  reason: string | null;
  owner: string | null;
};

export type ChurnedClientList = {
  clients: ChurnedClient[];
  count: number;
  sourceNote: string;
  live: boolean;
};

const SNAPSHOT_AS_OF = "2026-11-09";
const SNAPSHOT_NOTE =
  "Salesforce: Past Client depository accounts, closed in trailing 12 months. Snapshot Nov 9, 2026. Definition pending confirmation with Max.";

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function ownerName(value: unknown): string | null {
  const direct = text(value);
  if (direct) return direct;
  if (value && typeof value === "object" && "Name" in value) return text((value as { Name?: unknown }).Name);
  return null;
}

function dateOnly(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
  return match ? match[1] : null;
}

function days(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function clientFromRecord(record: Record<string, unknown>): ChurnedClient | null {
  const name = text(record.Name);
  if (!name) return null;
  return {
    name,
    closedOn: dateOnly(record.Closed_AMC_Date__c),
    lastOrderOn: dateOnly(record.Last_Order_Date__c),
    daysSinceLastOrder: days(record.Days_Since_Last_Order__c),
    reason: text(record.AMC_Closed_Lost_Reason__c),
    owner: ownerName(record.Owner),
  };
}

export function sortChurned(clients: ChurnedClient[]): ChurnedClient[] {
  return [...clients].sort((a, b) => (b.closedOn || "").localeCompare(a.closedOn || "") || a.name.localeCompare(b.name));
}

export function clientsFromSeedFile(raw: unknown): ChurnedClient[] {
  const body = raw as {
    lists?: { recommended_ttm_closed_amc_past_client_depository?: { accounts?: Record<string, unknown>[] } };
  };
  const accounts = body.lists?.recommended_ttm_closed_amc_past_client_depository?.accounts || [];
  return sortChurned(accounts.map(clientFromRecord).filter((client): client is ChurnedClient => Boolean(client)));
}

export async function seedChurnedClients(): Promise<void> {
  const existing = await query<{ n: number }>(
    "SELECT count(*)::int AS n FROM churned_clients WHERE source = 'snapshot' AND as_of = $1",
    [SNAPSHOT_AS_OF],
  );
  if (Number(existing[0]?.n || 0) > 0) return;
  const raw = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "seed", "churned_clients.json"), "utf8")) as unknown;
  for (const client of clientsFromSeedFile(raw)) {
    await query(
      `INSERT INTO churned_clients (
         id, name, closed_on, last_order_on, days_since_last_order, reason, owner_name, source, as_of
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'snapshot', $8)`,
      [
        randomUUID(),
        client.name,
        client.closedOn,
        client.lastOrderOn,
        client.daysSinceLastOrder,
        client.reason,
        client.owner,
        SNAPSHOT_AS_OF,
      ],
    );
  }
}

function asIso(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return dateOnly(String(value)) || String(value).slice(0, 10);
}

export async function loadChurnedClients(): Promise<ChurnedClientList> {
  const snapshots = await sql<{ pulled_at: string; payload: string | null }>(
    "SELECT pulled_at, payload FROM salesforce_snapshots WHERE payload IS NOT NULL ORDER BY pulled_at DESC LIMIT 1",
  );
  const payload = snapshots[0]?.payload ? (JSON.parse(snapshots[0].payload) as { queries?: Record<string, { ok?: boolean; records?: Record<string, unknown>[] }> }) : null;
  const liveQuery = payload?.queries?.churned_accounts;
  if (liveQuery?.ok) {
    const clients = sortChurned((liveQuery.records || []).map(clientFromRecord).filter((client): client is ChurnedClient => Boolean(client)));
    const pulled = snapshots[0]?.pulled_at ? formatIsoDate(new Date(snapshots[0].pulled_at).toISOString()) : "the latest pull";
    return {
      clients,
      count: clients.length,
      live: true,
      sourceNote: `Salesforce: Past Client depository accounts, closed in trailing 12 months. Live pull ${pulled}.`,
    };
  }
  const rows = await sql<Record<string, unknown>>(
    "SELECT name, closed_on, last_order_on, days_since_last_order, reason, owner_name FROM churned_clients WHERE source = 'snapshot'",
  );
  const clients = sortChurned(
    rows.map((row) => ({
      name: String(row.name),
      closedOn: asIso(row.closed_on),
      lastOrderOn: asIso(row.last_order_on),
      daysSinceLastOrder: row.days_since_last_order == null ? null : Math.round(Number(row.days_since_last_order)),
      reason: row.reason == null ? null : String(row.reason),
      owner: row.owner_name == null ? null : String(row.owner_name),
    })),
  );
  return { clients, count: clients.length, live: false, sourceNote: SNAPSHOT_NOTE };
}

export function formatChurnDate(iso: string | null): string {
  return iso ? formatIsoDate(iso) : "—";
}
