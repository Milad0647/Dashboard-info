import { redirect } from "next/navigation";
import { getAdminData } from "@/lib/data-access/admin";
import { resolveAdminCampaignId } from "@/lib/admin-campaign";
import { PerformanceAdmin } from "@/components/admin/performance-admin";
import { canScoreContent } from "@/lib/auth/access";
import { getAuthSession } from "@/lib/auth/get-session";
import { buildLeaderboardSourceFromAdmin } from "@/lib/performance-overview";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ campaign?: string }>;
}

export default async function PerformancePage({ searchParams }: PageProps) {
  const session = await getAuthSession();
  if (!session || !canScoreContent(session)) {
    redirect("/admin");
  }

  const params = await searchParams;
  const { campaignId } = await resolveAdminCampaignId(params.campaign);
  if (!campaignId) redirect("/admin/campaigns");

  const data = await getAdminData(campaignId, [
    "settings",
    "billboards",
    "posters",
    "posterVersions",
    "videos",
    "videoVersions",
    "files",
    "socialPosts",
    "activities",
  ]);
  if (!data.settings) redirect("/admin/campaigns");

  const source = buildLeaderboardSourceFromAdmin({
    billboards: data.billboards,
    posters: data.posters,
    posterVersions: data.posterVersions,
    videos: data.videos,
    videoVersions: data.videoVersions,
    socialPosts: data.socialPosts,
    activities: data.activities,
    files: data.files,
  });

  return (
    <PerformanceAdmin
      source={source}
      campaignId={campaignId}
      campaignTitle={data.settings.title}
      campaignSlug={data.settings.slug}
    />
  );
}
