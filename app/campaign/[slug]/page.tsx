import { notFound } from "next/navigation";
import { getPublicCampaignData } from "@/lib/data-access/campaign";
import { CampaignDashboard } from "@/components/public/campaign-dashboard";
import { CampaignPageUnlock } from "@/components/public/campaign-page-unlock";
import { canScoreContent } from "@/lib/auth/access";
import { getAuthSession, isFullAdmin } from "@/lib/auth/get-session";
import { resolveCampaignHeaderUser } from "@/lib/campaign-header-user";
import { isCampaignPageUnlockedWithGate } from "@/lib/campaign-page-unlock";
import { pgGetCampaignPageLockGate } from "@/lib/db/repository-extended";
import { isPostgresConfigured } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface CampaignPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ export?: string }>;
}

export default async function CampaignPage({ params, searchParams }: CampaignPageProps) {
  const { slug } = await params;
  const { export: exportParam } = await searchParams;

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

  const canScore = Boolean(session && canScoreContent(session));
  // Screenshot PDF export is admin-only (avoids heavy full-page capture for others)
  const exportMode = exportParam === "screenshot" && Boolean(session && isFullAdmin(session));

  return (
    <CampaignDashboard
      initialData={data}
      slug={slug}
      exportMode={exportMode}
      canScore={canScore}
      headerUser={headerUser}
    />
  );
}
