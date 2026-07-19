import { notFound } from "next/navigation";
import { getPublicCampaignData } from "@/lib/data-access/campaign";
import { CityLeaderboardDashboard } from "@/components/public/city-leaderboard-dashboard";
import { CampaignPageUnlock } from "@/components/public/campaign-page-unlock";
import { canScoreContent } from "@/lib/auth/access";
import { getAuthSession } from "@/lib/auth/get-session";
import { resolveCampaignHeaderUser } from "@/lib/campaign-header-user";
import { isCampaignPageUnlockedWithGate } from "@/lib/campaign-page-unlock";
import { pgGetCampaignPageLockGate } from "@/lib/db/repository-extended";
import { isPostgresConfigured } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface CityLeaderboardPageProps {
  params: Promise<{ slug: string }>;
}

export default async function CityLeaderboardPage({ params }: CityLeaderboardPageProps) {
  const { slug } = await params;

  let lockedTitle = slug;
  let lockGate: Awaited<ReturnType<typeof pgGetCampaignPageLockGate>> = null;

  if (isPostgresConfigured()) {
    lockGate = await pgGetCampaignPageLockGate(slug);
    if (!lockGate) notFound();
    lockedTitle = lockGate.title;
  }

  const session = await getAuthSession();
  const headerUser = resolveCampaignHeaderUser(session);
  const canBypassPassword = Boolean(session && canScoreContent(session));
  const requiresLock = Boolean(lockGate?.requiresLock);
  const unlocked =
    !requiresLock ||
    canBypassPassword ||
    (lockGate
      ? await isCampaignPageUnlockedWithGate(slug, {
          requiresLock: lockGate.requiresLock,
          sharedHash: lockGate.sharedHash,
          activeCodes: lockGate.activeCodes,
        })
      : true);

  if (requiresLock && !unlocked) {
    return <CampaignPageUnlock slug={slug} title={lockedTitle} headerUser={headerUser} />;
  }

  const data = await getPublicCampaignData(slug);
  if (!data) notFound();

  return <CityLeaderboardDashboard data={data} slug={slug} headerUser={headerUser} />;
}
