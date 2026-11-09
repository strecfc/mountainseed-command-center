import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it } from "vitest";
import { createUser } from "@/lib/auth";
import { ensureReady, sql } from "@/lib/db";
import { middleware } from "@/middleware";

const root = path.join(process.cwd(), "src", "app");

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function routePath(file: string): string {
  let rel = path.relative(root, file).replace(/\\/g, "/");
  rel = rel.replace(/\/(page|route)\.tsx?$/, "");
  rel = rel.replace(/(^|\/)\([^/]+\)(?=\/|$)/g, "");
  rel = rel.replace(/\[slug\]/g, "augur").replace(/\[id\]/g, "example");
  rel = rel.replace(/\/+/g, "/").replace(/^\//, "").replace(/\/$/, "");
  return rel ? `/${rel}` : "/";
}

const PUBLIC_API = new Set(["/api/auth/login"]);

describe("unauthenticated access", () => {
  const pages = walk(root).filter((file) => file.endsWith("page.tsx"));
  const routes = walk(root).filter((file) => file.endsWith("route.ts"));

  beforeAll(async () => {
    await ensureReady();
  });

  it("finds the private pages and the data routes", () => {
    expect(pages.map(routePath)).toEqual(expect.arrayContaining(["/", "/growth", "/defense", "/operations", "/admin", "/notes"]));
    expect(routes.map(routePath)).toEqual(
      expect.arrayContaining(["/api/dashboard", "/api/metrics", "/api/ingest", "/api/cron/daily", "/api/admin/users"]),
    );
  });

  it("redirects every non-public page when no session cookie is present", () => {
    for (const file of pages) {
      const pathname = routePath(file);
      const response = middleware(new NextRequest(new URL(`http://localhost${pathname}`)));
      if (pathname === "/login" || pathname === "/set-password") {
        expect(response.status, pathname).toBe(200);
      } else {
        expect(response.status, pathname).toBeGreaterThanOrEqual(300);
        expect(response.status, pathname).toBeLessThan(400);
        expect(response.headers.get("location"), pathname).toContain("/login");
      }
    }
  });

  it("blocks every API route in middleware without a session, except sign-in and set-password", () => {
    for (const file of routes) {
      const pathname = routePath(file);
      const response = middleware(new NextRequest(new URL(`http://localhost${pathname}`)));
      if (pathname === "/api/auth/login" || pathname === "/api/auth/set-password") {
        expect(response.status, pathname).toBe(200);
      } else {
        expect(response.status, pathname).toBe(401);
      }
    }
  });

  it("returns 401 from every data handler without a valid session", async () => {
    for (const file of routes) {
      const pathname = routePath(file);
      const mod = await import(pathToFile(file));
      for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"] as const) {
        const handler = mod[method] as ((req: Request, ctx?: unknown) => Promise<Response>) | undefined;
        if (!handler) continue;
        const response = await handler(
          new Request(`http://localhost${pathname}`, {
            method,
            headers: { cookie: "ms_session=not-a-real-session" },
          }),
          { params: Promise.resolve({ id: "example", slug: "augur" }) },
        );
        const body = await response.text();
        expect(body, `${method} ${pathname}`).not.toContain("68.1");
        expect(body, `${method} ${pathname}`).not.toContain("103.72");
        if (pathname === "/api/auth/login") {
          expect(response.status, `${method} ${pathname}`).toBe(400);
        } else if (!PUBLIC_API.has(pathname)) {
          expect(response.status, `${method} ${pathname}`).toBe(401);
        }
      }
    }
  });
});

function pathToFile(file: string): string {
  return file;
}

describe("signed-in access and seed", () => {
  it("lets the seeded admin open the dashboard and keeps missing figures empty", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    const login = await POST(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "Carl@mountainseed.com", password: "Correct-horse-battery-staple" }),
      }),
    );
    expect(login.status).toBe(200);
    const cookie = login.headers.get("set-cookie") || "";
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    const { GET } = await import("@/app/api/dashboard/route");
    const dashboard = await GET(
      new Request("http://localhost/api/dashboard", { headers: { cookie: cookie.split(";")[0] } }),
    );
    expect(dashboard.status).toBe(200);
    const body = await dashboard.json();
    const margin = body.heroes.find((hero: { id: string }) => hero.id === "gross-margin");
    const ebitda = body.heroes.find((hero: { id: string }) => hero.id === "ebitda");
    const revenue = body.heroes.find((hero: { id: string }) => hero.id === "revenue");
    expect(margin.headline).toBe("68.1%");
    expect(margin.overall).toBe("yellow");
    expect(ebitda.headline).toBe("Awaiting data");
    expect(revenue.headline).toBe("Awaiting data");
    expect(revenue.goal).toContain("53");
    const churn = body.defense.find((item: { label: string }) => item.label === "MP Client Logo Churn");
    expect(churn.overall).toBe("green");
    expect(churn.windows[0].value).toBe("9.02%");
    const retention = body.defense.find((item: { label: string }) => item.label === "Year-over-Year Net Retention %");
    expect(retention.windows[0].value).toBe("89%");
    expect(retention.overall).toBe("red");
    expect(body.salesforce.state).toBe("not_connected");
    expect(body.newSales.find((item: { label: string }) => item.label === "Pipeline coverage").headline).toBe("Awaiting data");
    expect(body.augur.deals.length).toBeGreaterThan(10);
  });

  it("rejects a viewer from admin user creation and accepts an ingest token", async () => {
    await createUser({
      email: "viewer@mountainseed.com",
      name: "Viewer",
      role: "viewer",
      password: "viewer-password-ok",
    });
    const { POST: loginPost } = await import("@/app/api/auth/login/route");
    const login = await loginPost(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "viewer@mountainseed.com", password: "viewer-password-ok" }),
      }),
    );
    const cookie = (login.headers.get("set-cookie") || "").split(";")[0];
    const { POST: create } = await import("@/app/api/admin/users/route");
    const denied = await create(
      new Request("http://localhost/api/admin/users", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ email: "new@mountainseed.com", name: "New", role: "viewer", temporaryPassword: "temporary-password" }),
      }),
    );
    expect(denied.status).toBe(403);

    const { newToken, hashToken } = await import("@/lib/auth");
    const { randomUUID } = await import("node:crypto");
    const token = newToken();
    await sql(
      "INSERT INTO ingest_tokens (id, name, token_hash, token_prefix, created_by) VALUES ($1, $2, $3, $4, $5)",
      [randomUUID(), "test", hashToken(token), token.slice(0, 6), "test"],
    );
    const { POST: ingest } = await import("@/app/api/ingest/route");
    const missing = await ingest(new Request("http://localhost/api/ingest", { method: "POST", body: "{}" }));
    expect(missing.status).toBe(401);
    const saved = await ingest(
      new Request("http://localhost/api/ingest", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({
          dataset: "notes",
          weekEnding: "2026-10-25",
          note: { whatChanged: "Pipeline held.", owner: "Max", nextStep: "Review Wednesday." },
        }),
      }),
    );
    expect(saved.status).toBe(200);
  });
});
