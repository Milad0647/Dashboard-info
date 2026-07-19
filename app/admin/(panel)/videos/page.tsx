import { redirect } from "next/navigation";
import { getAdminData } from "@/lib/data-access/admin";
import { resolveAdminCampaignId } from "@/lib/admin-campaign";
import { getAdminBulkEditProps } from "@/lib/admin-bulk-edit-props";
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
  const videoSections = ["videos", "videoCategories", "videoVersions"] as const;
  const [initialData, bulkProps] = await Promise.all([
    getAdminData(campaignId, [...videoSections]),
    getAdminBulkEditProps(),
  ]);
  let data = initialData;
  const seeded = await ensureVideoTypeCategories(campaignId, data.videoCategories);
  if (seeded) {
    data = await getAdminData(campaignId, [...videoSections]);
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
      isFullAdmin={bulkProps.isFullAdmin}
      canTransferOwnership={bulkProps.canTransferOwnership}
      users={bulkProps.users}
    />
  );
}
