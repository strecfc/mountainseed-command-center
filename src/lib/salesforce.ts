import { randomUUID } from "node:crypto";
import { query, ready } from "./db";

export type SalesforceQueryResult = {
  ok: boolean;
  records?: Record<string, unknown>[];
  error?: string;
};

export type SalesforcePayload = {
  queries: Record<string, SalesforceQueryResult>;
};

const DEFAULT_QUERIES: Record<string, string> = {
  open_pipeline:
    "SELECT SUM(Amount) total, COUNT(Id) n FROM Opportunity WHERE IsClosed = false",
  wins_ytd:
    "SELECT SUM(Amount) total, COUNT(Id) n FROM Opportunity WHERE IsWon = true AND CloseDate = THIS_YEAR",
  new_accounts: "SELECT COUNT(Id) n FROM Account WHERE CreatedDate = THIS_YEAR",
  upsell:
    "SELECT COUNT(Id) n, SUM(Amount) total FROM Opportunity WHERE IsClosed = false AND Type = 'Existing Business'",
  ma_stages:
    "SELECT StageName, COUNT(Id) n, SUM(Amount) total FROM Opportunity WHERE RecordType.Name = 'M&As' GROUP BY StageName",
  churn_cases: "SELECT COUNT(Id) n FROM Case WHERE IsClosed = false AND Subject LIKE '%churn%'",
};

export type SalesforceConfig = {
  loginUrl: string;
  clientId: string;
  clientSecret: string;
  grantType: "client_credentials" | "password";
  username: string | null;
  password: string | null;
};

export function salesforceConfig(): SalesforceConfig | null {
  const loginUrl = (process.env.SF_LOGIN_URL || "").trim().replace(/\/$/, "");
  const clientId = process.env.SF_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.SF_CLIENT_SECRET?.trim() || "";
  if (!loginUrl || !clientId || !clientSecret) return null;
  const username = process.env.SF_USERNAME?.trim() || "";
  const password = process.env.SF_PASSWORD || "";
  if (username && password) {
    return {
      loginUrl,
      clientId,
      clientSecret,
      grantType: "password",
      username,
      password: `${password}${process.env.SF_SECURITY_TOKEN || ""}`,
    };
  }
  return {
    loginUrl,
    clientId,
    clientSecret,
    grantType: "client_credentials",
    username: null,
    password: null,
  };
}

export function salesforceQueries(): Record<string, string> {
  const raw = process.env.SF_SOQL_JSON?.trim();
  if (!raw) return DEFAULT_QUERIES;
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    if (!parsed || typeof parsed !== "object") return DEFAULT_QUERIES;
    return { ...DEFAULT_QUERIES, ...parsed };
  } catch {
    return DEFAULT_QUERIES;
  }
}

function scrub(message: string, config: SalesforceConfig): string {
  let out = message.split(config.clientSecret).join("[redacted]").split(config.clientId).join("[redacted]");
  if (config.password) out = out.split(config.password).join("[redacted]");
  return out;
}

async function soql(
  instanceUrl: string,
  accessToken: string,
  queryText: string,
): Promise<Record<string, unknown>[]> {
  const url = `${instanceUrl}/services/data/v61.0/query?q=${encodeURIComponent(queryText)}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const body = (await response.json().catch(() => ({}))) as {
    records?: Record<string, unknown>[];
    message?: string;
    errorCode?: string;
  };
  if (!response.ok) {
    const detail = Array.isArray(body) ? JSON.stringify(body) : body.message || body.errorCode || response.statusText;
    throw new Error(String(detail));
  }
  return body.records || [];
}

export async function pullSalesforce(): Promise<{ status: string; message: string; payload: SalesforcePayload | null }> {
  const config = salesforceConfig();
  if (!config) {
    return {
      status: "not_connected",
      message: "Salesforce credentials are not configured.",
      payload: null,
    };
  }
  const body = new URLSearchParams({
    grant_type: config.grantType,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });
  if (config.grantType === "password" && config.username && config.password) {
    body.set("username", config.username);
    body.set("password", config.password);
  }
  let instanceUrl = "";
  let accessToken = "";
  try {
    const response = await fetch(`${config.loginUrl}/services/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const token = (await response.json().catch(() => ({}))) as {
      access_token?: string;
      instance_url?: string;
      error_description?: string;
    };
    if (!response.ok || !token.access_token || !token.instance_url) {
      throw new Error(token.error_description || "Salesforce login failed.");
    }
    instanceUrl = token.instance_url;
    accessToken = token.access_token;
  } catch (error) {
    const message = scrub(error instanceof Error ? error.message : "Salesforce login failed.", config);
    return { status: "error", message, payload: null };
  }

  const payload: SalesforcePayload = { queries: {} };
  let failures = 0;
  for (const [name, queryText] of Object.entries(salesforceQueries())) {
    try {
      payload.queries[name] = { ok: true, records: await soql(instanceUrl, accessToken, queryText) };
    } catch (error) {
      failures += 1;
      payload.queries[name] = {
        ok: false,
        error: scrub(error instanceof Error ? error.message : "Query failed.", config),
      };
    }
  }
  const status = failures === 0 ? "ok" : failures === Object.keys(payload.queries).length ? "error" : "partial";
  const message =
    status === "ok"
      ? "Salesforce pull completed."
      : status === "partial"
        ? "Salesforce pull completed with one or more query errors."
        : "Salesforce pull failed.";
  return { status, message, payload };
}

export async function runDailyPull(): Promise<{ status: string; message: string }> {
  const result = await pullSalesforce();
  if (result.status === "not_connected") return result;
  await ready();
  await query(
    "INSERT INTO salesforce_snapshots (id, pulled_at, status, message, payload) VALUES ($1, now(), $2, $3, $4)",
    [randomUUID(), result.status, result.message, result.payload ? JSON.stringify(result.payload) : null],
  );
  return result;
}

function num(record: Record<string, unknown> | undefined, key: string): number | null {
  if (!record) return null;
  const value = record[key];
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export type SalesforceView = {
  state: "not_connected" | "awaiting" | "ok" | "partial" | "error";
  message: string;
  pulledAt: string | null;
  pipelineAmount: number | null;
  pipelineCount: number | null;
  winsAmount: number | null;
  winsCount: number | null;
  newClients: number | null;
  upsellCount: number | null;
  upsellAmount: number | null;
  churnCases: number | null;
  maStages: { stage: string; count: number; amount: number | null }[] | null;
  queryErrors: { name: string; error: string }[];
};

export async function salesforceView(): Promise<SalesforceView> {
  const empty: SalesforceView = {
    state: salesforceConfig() ? "awaiting" : "not_connected",
    message: salesforceConfig()
      ? "Credentials are set. The daily pull has not run yet."
      : "Not connected",
    pulledAt: null,
    pipelineAmount: null,
    pipelineCount: null,
    winsAmount: null,
    winsCount: null,
    newClients: null,
    upsellCount: null,
    upsellAmount: null,
    churnCases: null,
    maStages: null,
    queryErrors: [],
  };
  if (!salesforceConfig()) return empty;
  await ready();
  const rows = await query<{ pulled_at: string; status: string; message: string | null; payload: string | null }>(
    "SELECT pulled_at, status, message, payload FROM salesforce_snapshots ORDER BY pulled_at DESC LIMIT 1",
  );
  const row = rows[0];
  if (!row) return empty;
  const payload = row.payload ? (JSON.parse(row.payload) as SalesforcePayload) : { queries: {} };
  const first = (name: string) => payload.queries[name]?.records?.[0];
  const errors = Object.entries(payload.queries)
    .filter(([, value]) => !value.ok && value.error)
    .map(([name, value]) => ({ name, error: value.error || "Query failed." }));
  const stages = payload.queries.ma_stages?.ok
    ? (payload.queries.ma_stages.records || []).map((record) => ({
        stage: String(record.StageName ?? record.stagename ?? "Unknown"),
        count: num(record, "n") ?? 0,
        amount: num(record, "total"),
      }))
    : null;
  return {
    state: row.status === "ok" || row.status === "partial" || row.status === "error" ? (row.status as SalesforceView["state"]) : "error",
    message: row.message || "",
    pulledAt: new Date(row.pulled_at).toISOString(),
    pipelineAmount: num(first("open_pipeline"), "total"),
    pipelineCount: num(first("open_pipeline"), "n"),
    winsAmount: num(first("wins_ytd"), "total"),
    winsCount: num(first("wins_ytd"), "n"),
    newClients: num(first("new_accounts"), "n"),
    upsellCount: num(first("upsell"), "n"),
    upsellAmount: num(first("upsell"), "total"),
    churnCases: num(first("churn_cases"), "n"),
    maStages: stages,
    queryErrors: errors,
  };
}
