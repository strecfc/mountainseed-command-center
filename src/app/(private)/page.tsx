import { HomeBoard } from "@/components/HomeBoard";
import { requirePageUser } from "@/lib/current-user";
import { getDashboard } from "@/lib/dashboard";

export default async function HomePage() {
  await requirePageUser();
  const model = await getDashboard();
  return (
    <>
      <p className="home-week">Week ending {model.featuredLabel}</p>
      <HomeBoard model={model} />
    </>
  );
}
