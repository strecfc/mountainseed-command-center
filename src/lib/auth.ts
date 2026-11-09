import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { getDummyPasswordHash, query, ready } from "./db";

async function db<T>(text: string, params: unknown[] = []): Promise<T[]> {
  await ready();
  return query<T>(text, params);
}

export type Role = "admin" | "viewer";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  disabled: boolean;
  mustChangePassword: boolean;
};

const COOKIE = "ms_session";

export function sessionHours(): number {
  const n = Number(process.env.SESSION_HOURS || 18);
  return Number.isFinite(n) && n > 0 ? n : 18;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function hashPassword(password: string): Promise<string> {
  const argon2 = await import("argon2");
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  const argon2 = await import("argon2");
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export function requestIsSecure(req: Request): boolean {
  if (process.env.COOKIE_SECURE === "true") return true;
  if (process.env.COOKIE_SECURE === "false") return false;
  const forwarded = req.headers.get("x-forwarded-proto");
  if (forwarded) return forwarded.split(",")[0].trim() === "https";
  try {
    return new URL(req.url).protocol === "https:";
  } catch {
    return false;
  }
}

export function cookieHeader(token: string, req: Request): string {
  const secure = requestIsSecure(req) ? "; Secure" : "";
  const maxAge = Math.round(sessionHours() * 3600);
  return `${COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function clearCookieHeader(req: Request): string {
  const secure = requestIsSecure(req) ? "; Secure" : "";
  return `${COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`;
}

export function readCookie(req: Request, name = COOKIE): string | null {
  const header = req.headers.get("cookie") || "";
  const parts = header.split(";");
  for (const part of parts) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim().slice(0, 64);
  return "local";
}

function mapUser(row: {
  id: string;
  email: string;
  name: string;
  role: string;
  disabled: boolean;
  must_change_password: boolean;
}): SessionUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role === "admin" ? "admin" : "viewer",
    disabled: Boolean(row.disabled),
    mustChangePassword: Boolean(row.must_change_password),
  };
}

export async function userForToken(token: string | null | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const rows = await db<{
    id: string;
    email: string;
    name: string;
    role: string;
    disabled: boolean;
    must_change_password: boolean;
    expires_at: string;
  }>(
    `SELECT u.id, u.email, u.name, u.role, u.disabled, u.must_change_password, s.expires_at
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1`,
    [hashToken(token)],
  );
  const row = rows[0];
  if (!row) return null;
  if (row.disabled) return null;
  if (new Date(row.expires_at).getTime() <= Date.now()) return null;
  return mapUser(row);
}

export async function getUserFromRequest(req: Request): Promise<SessionUser | null> {
  return userForToken(readCookie(req));
}

export async function recordLoginAttempt(email: string, ip: string, success: boolean): Promise<void> {
  await db(
    "INSERT INTO login_attempts (email, ip, success) VALUES ($1, $2, $3)",
    [email.toLowerCase(), ip, success],
  );
  await db("DELETE FROM login_attempts WHERE attempted_at < now() - interval '2 days'");
}

export async function loginAllowed(email: string, ip: string): Promise<boolean> {
  const emailRows = await db<{ n: number }>(
    `SELECT count(*)::int AS n FROM login_attempts
     WHERE lower(email) = lower($1) AND success = FALSE
       AND attempted_at > now() - interval '15 minutes'`,
    [email],
  );
  const ipRows = await db<{ n: number }>(
    `SELECT count(*)::int AS n FROM login_attempts
     WHERE ip = $1 AND success = FALSE
       AND attempted_at > now() - interval '15 minutes'`,
    [ip],
  );
  return Number(emailRows[0]?.n || 0) < 8 && Number(ipRows[0]?.n || 0) < 20;
}

export async function login(email: string, password: string, ip: string): Promise<
  | { ok: true; token: string; user: SessionUser }
  | { ok: false; status: number; error: string }
> {
  const normalized = email.trim();
  if (!normalized || !password) {
    return { ok: false, status: 400, error: "Email and password are required." };
  }
  if (!(await loginAllowed(normalized, ip))) {
    return { ok: false, status: 429, error: "Too many sign-in attempts. Try again in 15 minutes." };
  }
  const rows = await db<{
    id: string;
    email: string;
    name: string;
    role: string;
    disabled: boolean;
    must_change_password: boolean;
    password_hash: string;
  }>("SELECT * FROM users WHERE lower(email) = lower($1)", [normalized]);
  const row = rows[0];
  const hash = row?.password_hash || getDummyPasswordHash();
  const match = await verifyPassword(hash, password);
  if (!row || !match || row.disabled) {
    await recordLoginAttempt(normalized, ip, false);
    return { ok: false, status: 401, error: "Invalid email or password." };
  }
  await recordLoginAttempt(normalized, ip, true);
  const token = newToken();
  const expires = new Date(Date.now() + sessionHours() * 3600 * 1000);
  await db(
    "INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)",
    [randomUUID(), row.id, hashToken(token), expires.toISOString()],
  );
  return { ok: true, token, user: mapUser(row) };
}

export async function destroySession(token: string | null): Promise<void> {
  if (!token) return;
  await db("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
}

export async function createUser(input: {
  email: string;
  name: string;
  role: Role;
  password: string;
  mustChangePassword?: boolean;
}): Promise<SessionUser> {
  const id = randomUUID();
  const passwordHash = await hashPassword(input.password);
  await db(
    `INSERT INTO users (id, email, name, role, password_hash, must_change_password)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      id,
      input.email.trim(),
      input.name.trim(),
      input.role,
      passwordHash,
      Boolean(input.mustChangePassword),
    ],
  );
  return {
    id,
    email: input.email.trim(),
    name: input.name.trim(),
    role: input.role,
    disabled: false,
    mustChangePassword: Boolean(input.mustChangePassword),
  };
}

export async function issuePasswordToken(userId: string, hours = 72): Promise<string> {
  const token = newToken();
  const expires = new Date(Date.now() + hours * 3600 * 1000);
  await db(
    "INSERT INTO password_tokens (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)",
    [randomUUID(), userId, hashToken(token), expires.toISOString()],
  );
  return token;
}

export function inviteUrl(token: string, origin?: string): string {
  const base = (origin || process.env.APP_BASE_URL || "").replace(/\/$/, "");
  return `${base}/set-password?token=${encodeURIComponent(token)}`;
}

export async function consumePasswordToken(token: string, password: string): Promise<
  | { ok: true }
  | { ok: false; error: string }
> {
  if (!token) return { ok: false, error: "This link is missing a token." };
  if (password.length < 10) {
    return { ok: false, error: "Use at least 10 characters." };
  }
  const rows = await db<{ id: string; user_id: string; expires_at: string; used_at: string | null }>(
    "SELECT id, user_id, expires_at, used_at FROM password_tokens WHERE token_hash = $1",
    [hashToken(token)],
  );
  const row = rows[0];
  if (!row || row.used_at || new Date(row.expires_at).getTime() <= Date.now()) {
    return { ok: false, error: "This link is invalid or has expired." };
  }
  const passwordHash = await hashPassword(password);
  await db(
    `UPDATE users SET password_hash = $1, must_change_password = FALSE, updated_at = now() WHERE id = $2`,
    [passwordHash, row.user_id],
  );
  await db("UPDATE password_tokens SET used_at = now() WHERE id = $1", [row.id]);
  await db("DELETE FROM sessions WHERE user_id = $1", [row.user_id]);
  return { ok: true };
}

export async function setTemporaryPassword(userId: string, password: string): Promise<void> {
  if (password.length < 10) throw new Error("Use at least 10 characters.");
  const passwordHash = await hashPassword(password);
  await db(
    `UPDATE users SET password_hash = $1, must_change_password = TRUE, disabled = FALSE, updated_at = now()
     WHERE id = $2`,
    [passwordHash, userId],
  );
  await db("DELETE FROM sessions WHERE user_id = $1", [userId]);
}

export function tokensEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export async function seedAdminFromEnv(): Promise<void> {
  const email = (process.env.ADMIN_EMAIL || "Carl@mountainseed.com").trim();
  const password = process.env.ADMIN_PASSWORD || "";
  const name = (process.env.ADMIN_NAME || "Carl Streck").trim();
  if (!password) {
    console.warn("ADMIN_PASSWORD is not set. No admin account was created.");
    return;
  }
  if (password.length < 10) {
    console.warn("ADMIN_PASSWORD must be at least 10 characters. No admin account was created.");
    return;
  }
  const existing = await query<{ id: string }>("SELECT id FROM users WHERE lower(email) = lower($1)", [
    email,
  ]);
  if (existing.length) return;
  await createUser({ email, name, role: "admin", password, mustChangePassword: false });
}

export async function countAdmins(): Promise<number> {
  const rows = await db<{ n: number }>(
    "SELECT count(*)::int AS n FROM users WHERE role = 'admin' AND disabled = FALSE",
  );
  return Number(rows[0]?.n || 0);
}
