import { Shell } from "@/components/Shell";
import { requirePageUser } from "@/lib/current-user";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser();
  return <Shell user={user}>{children}</Shell>;
}
