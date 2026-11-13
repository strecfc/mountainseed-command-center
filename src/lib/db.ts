import { SCHEMA_SQL } from "./schema";

type Row = Record<string, unknown>;

type Client = {
  query(text: string, params?: unknown[]): Promise<Row[]>;
  exec(script: string): Promise<void>;
};

let client: Client | null = null;
let initPromise: Promise<void> | null = null;
let dummyPasswordHash: string | null = null;

function databaseUrl(): string {
  return (process.env.DATABASE_URL || "").trim();
}

function usePostgres(): boolean {
  const url = databaseUrl();
  return url.startsWith("postgres://") || url.startsWith("postgresql://");
}

async function open(): Promise<Client> {
  if (usePostgres()) {
    const { Pool } = await import("pg");
    const ssl =
      process.env.DATABASE_SSL === "require" ? { rejectUnauthorized: false as const } : undefined;
    const pool = new Pool({ connectionString: databaseUrl(), ssl });
    return {
      async query(text, params = []) {
        const result = await pool.query(text, params as never[]);
        return result.rows as Row[];
      },
      async exec(script) {
        const statements = script
          .split(";")
          .map((part) => part.trim())
          .filter(Boolean);
        for (const statement of statements) {
          await pool.query(statement);
        }
      },
    };
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const dir = process.env.PGLITE_DIR || "data/pglite";
  const db = dir === ":memory:" ? new PGlite() : new PGlite(dir);
  await db.waitReady;
  return {
    async query(text, params = []) {
      const result = await db.query(text, params as never[]);
      return result.rows as Row[];
    },
    async exec(script) {
      await db.exec(script);
    },
  };
}

async function init(): Promise<void> {
  client = await open();
  await client.exec(SCHEMA_SQL);
  const existing = await client.query("SELECT id FROM schema_migrations WHERE id = $1", ["001"]);
  if (!existing.length) {
    await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", ["001"]);
  }
  const argon2 = await import("argon2");
  dummyPasswordHash = await argon2.hash("not-a-real-password-used-for-timing");
  const { seedDatabase } = await import("./seed");
  await seedDatabase();
  if (process.env.ENABLE_DAILY_JOB !== "false") {
    const { startDailyJob } = await import("./jobs");
    startDailyJob();
  }
}

export function ensureReady(): Promise<void> {
  if (!initPromise) initPromise = init();
  return initPromise;
}

export async function ready(): Promise<void> {
  if (!client) await ensureReady();
}

export async function query<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  if (!client) throw new Error("Database is not ready");
  return (await client.query(text, params)) as T[];
}

export async function sql<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  await ensureReady();
  return query<T>(text, params);
}

export function getDummyPasswordHash(): string {
  if (!dummyPasswordHash) throw new Error("Password hasher is not ready");
  return dummyPasswordHash;
}

export async function metaGet(key: string): Promise<string | null> {
  const rows = await query<{ value: string }>("SELECT value FROM app_meta WHERE key = $1", [key]);
  return rows[0]?.value ?? null;
}

export async function metaSet(key: string, value: string): Promise<void> {
  await query(
    `INSERT INTO app_meta (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, value],
  );
}
