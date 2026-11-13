import { HomeBoard } from "@/components/HomeBoard";
import { loadChurnedClients } from "@/lib/churned-clients";
import { requirePageUser } from "@/lib/current-user";
import { getDashboard } from "@/lib/dashboard";

export default async function HomePage() {
  await requirePageUser();
  const [model, churned] = await Promise.all([getDashboard(), loadChurnedClients()]);
  return (
    <>
      <p className="home-week">Week ending {model.featuredLabel}</p>
      <HomeBoard model={model} recentChurn={churned.clients.slice(0, 2).map((client) => client.name)} />
    </>
  );
}
