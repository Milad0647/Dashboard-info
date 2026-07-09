import { notFound } from "next/navigation";
import { getPublicCampaignData } from "@/lib/data-access/campaign";
import { CityLeaderboardDashboard } from "@/components/public/city-leaderboard-dashboard";

export const dynamic = "force-dynamic";

interface CityLeaderboardPageProps {
  params: Promise<{ slug: string }>;
}

export default async function CityLeaderboardPage({ params }: CityLeaderboardPageProps) {
  const { slug } = await params;
  const data = await getPublicCampaignData(slug);

  if (!data) notFound();

  return <CityLeaderboardDashboard data={data} slug={slug} />;
}
