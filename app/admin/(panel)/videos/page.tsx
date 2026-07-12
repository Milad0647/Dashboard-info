import { redirect } from "next/navigation";
import { getAdminData } from "@/lib/data-access/admin";
import { resolveAdminCampaignId } from "@/lib/admin-campaign";
import { canScoreContent } from "@/lib/auth/access";
import { getAuthSession } from "@/lib/auth/get-session";
import { ensureVideoTypeCategories } from "@/lib/ensure-video-type-categories";
import { VideosAdmin } from "@/components/admin/videos-admin";

interface PageProps {
  searchParams: Promise<{ campaign?: string }>;
}

export default async function VideosPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { campaignId } = await resolveAdminCampaignId(params.campaign);
  if (!campaignId) redirect("/admin/campaigns");
  const session = await getAuthSession();
  const canScore = Boolean(session && canScoreContent(session));
  let data = await getAdminData(campaignId);
  const seeded = await ensureVideoTypeCategories(campaignId, data.videoCategories);
  if (seeded) {
    data = await getAdminData(campaignId);
  }
  return (
    <VideosAdmin
      campaignId={campaignId}
      initialCategories={data.videoCategories}
      initialVideos={data.videos}
      initialVersions={data.videoVersions}
      contentPlans={data.settings?.contentPlans ?? []}
      contentTopics={data.settings?.contentTopics ?? []}
      canScore={canScore}
    />
  );
}
