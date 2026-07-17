import { redirect } from "next/navigation";
import { getAdminData } from "@/lib/data-access/admin";
import { resolveAdminCampaignId } from "@/lib/admin-campaign";
import { getAdminBulkEditProps } from "@/lib/admin-bulk-edit-props";
import { requireContributorAccess } from "@/lib/auth/require-contributor-access";
import { SocialAnalyticsAdmin } from "@/components/admin/social-analytics-admin";

interface PageProps {
  searchParams: Promise<{ campaign?: string }>;
}

export default async function SocialAnalyticsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { campaignId } = await resolveAdminCampaignId(params.campaign);
  if (!campaignId) redirect("/admin/campaigns");
  await requireContributorAccess(campaignId, "socialPosts");
  const [data, bulkProps] = await Promise.all([
    getAdminData(campaignId, ["socialPlatformStats"]),
    getAdminBulkEditProps(),
  ]);
  return (
    <SocialAnalyticsAdmin
      campaignId={campaignId}
      initialStats={data.socialPlatformStats ?? []}
      contentPlans={data.settings?.contentPlans ?? []}
      isFullAdmin={bulkProps.isFullAdmin}
    />
  );
}
