import { notFound } from "next/navigation";
import { getPublicCampaignData } from "@/lib/data-access/campaign";
import { CityLeaderboardDashboard } from "@/components/public/city-leaderboard-dashboard";
import { resolveCampaignHeaderUser } from "@/components/public/campaign-header-auth";
import { CampaignPageUnlock } from "@/components/public/campaign-page-unlock";
import { canScoreContent } from "@/lib/auth/access";
import { getAuthSession } from "@/lib/auth/get-session";
import { isCampaignPageUnlocked } from "@/lib/campaign-page-unlock";
import { pgGetPublishedCampaignBySlug } from "@/lib/db/repository";
import { isPostgresConfigured } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface CityLeaderboardPageProps {
  params: Promise<{ slug: string }>;
}

export default async function CityLeaderboardPage({ params }: CityLeaderboardPageProps) {
  const { slug } = await params;

  let pagePasswordHash: string | null = null;
  let lockedTitle = slug;

  if (isPostgresConfigured()) {
    const settings = await pgGetPublishedCampaignBySlug(slug);
    if (!settings) notFound();
    pagePasswordHash = settings.pageViewPasswordHash ?? null;
    lockedTitle = settings.title;
  }

  const session = await getAuthSession();
  const headerUser = resolveCampaignHeaderUser(session);
  const canBypassPassword = Boolean(session && canScoreContent(session));
  const unlocked =
    !pagePasswordHash ||
    canBypassPassword ||
    (await isCampaignPageUnlocked(slug, pagePasswordHash));

  if (pagePasswordHash && !unlocked) {
    return <CampaignPageUnlock slug={slug} title={lockedTitle} headerUser={headerUser} />;
  }

  const data = await getPublicCampaignData(slug);
  if (!data) notFound();

  return <CityLeaderboardDashboard data={data} slug={slug} headerUser={headerUser} />;
}
