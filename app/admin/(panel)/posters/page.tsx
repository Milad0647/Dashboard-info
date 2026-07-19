import { redirect } from "next/navigation";
import { getAdminData } from "@/lib/data-access/admin";
import { resolveAdminCampaignId } from "@/lib/admin-campaign";
import { getAdminBulkEditProps } from "@/lib/admin-bulk-edit-props";
import { canScoreContent } from "@/lib/auth/access";
import { getAuthSession } from "@/lib/auth/get-session";
import { PostersAdmin } from "@/components/admin/posters-admin";

interface PageProps {
  searchParams: Promise<{ campaign?: string }>;
}

export default async function PostersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { campaignId } = await resolveAdminCampaignId(params.campaign);
  if (!campaignId) redirect("/admin/campaigns");
  const session = await getAuthSession();
  const canScore = Boolean(session && canScoreContent(session));
  const [data, bulkProps] = await Promise.all([
    getAdminData(campaignId, ["posters", "posterCategories", "posterVersions"]),
    getAdminBulkEditProps(),
  ]);
  return (
    <PostersAdmin
      campaignId={campaignId}
      initialCategories={data.posterCategories}
      initialPosters={data.posters}
      initialVersions={data.posterVersions}
      contentPlans={data.settings?.contentPlans ?? []}
      contentTopics={data.settings?.contentTopics ?? []}
      canScore={canScore}
      isFullAdmin={bulkProps.isFullAdmin}
      canTransferOwnership={bulkProps.canTransferOwnership}
      users={bulkProps.users}
    />
  );
}
