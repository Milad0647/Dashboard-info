import { redirect } from "next/navigation";
import { getAdminData } from "@/lib/data-access/admin";
import { resolveAdminCampaignId } from "@/lib/admin-campaign";
import { getAdminBulkEditProps } from "@/lib/admin-bulk-edit-props";
import { AnalyticsAdmin } from "@/components/admin/analytics-admin";

interface PageProps {
  searchParams: Promise<{ campaign?: string }>;
}

export default async function AnalyticsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { campaignId } = await resolveAdminCampaignId(params.campaign);
  if (!campaignId) redirect("/admin/campaigns");
  const [data, bulkProps] = await Promise.all([
    getAdminData(campaignId, ["analytics"]),
    getAdminBulkEditProps(),
  ]);
  return (
    <AnalyticsAdmin
      campaignId={campaignId}
      initialMetrics={data.analytics}
      contentPlans={data.settings?.contentPlans ?? []}
      isFullAdmin={bulkProps.isFullAdmin}
      canTransferOwnership={bulkProps.canTransferOwnership}
      users={bulkProps.users}
    />
  );
}
