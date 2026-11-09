"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  ["/", "Scoreboard"],
  ["/growth", "Growth"],
  ["/defense", "Defense"],
  ["/operations", "Operations"],
  ["/sections/augur", "Augur"],
  ["/sections/sales-leaseback", "Sales Leaseback"],
  ["/sections/nbp", "NBP"],
  ["/sections/finance", "Finance"],
  ["/notes", "Notes"],
];

export function NavLinks({ admin }: { admin: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="nav-row">
      {LINKS.map(([href, label]) => (
        <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>
          {label}
        </Link>
      ))}
      {admin ? (
        <Link href="/admin" aria-current={pathname.startsWith("/admin") ? "page" : undefined}>
          Admin
        </Link>
      ) : null}
    </nav>
  );
}
