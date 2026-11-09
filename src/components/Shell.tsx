import type { SessionUser } from "@/lib/auth";
import { NavLinks } from "./NavLinks";
import { SignOut } from "./SignOut";

export function Shell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  return (
    <>
      <header className="topbar">
        <div className="topbar-row">
          <p className="brand">
            MountainSeed
            <small>Leadership Command Center</small>
          </p>
          <div className="who">
            {user.name}
            <span>{user.role === "admin" ? "Admin" : "Viewer"}</span>
            <SignOut />
          </div>
        </div>
        <NavLinks admin={user.role === "admin"} />
      </header>
      <main className="wrap">{children}</main>
    </>
  );
}
