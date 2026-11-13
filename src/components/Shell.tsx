"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SessionUser } from "@/lib/auth";
import { SignOut } from "./SignOut";

export function Shell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const home = pathname === "/";
  return (
    <div className={home ? "home-app" : "app"}>
      <header className="topbar">
        <div className="topbar-row">
          <Link href="/" className="brand">
            MountainSeed
            {home ? null : <small>Leadership Command Center</small>}
          </Link>
          <div className="who">
            <span className="who-name">{user.name}</span>
            {user.role === "admin" && !home ? (
              <Link className="quiet-link" href="/admin">
                Admin
              </Link>
            ) : null}
            <SignOut />
          </div>
        </div>
      </header>
      <main className={home ? "home-main" : "wrap"}>{children}</main>
    </div>
  );
}
