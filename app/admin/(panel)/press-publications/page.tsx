import { redirect } from "next/navigation";
import { getAdminData } from "@/lib/data-access/admin";
import { resolveAdminCampaignId } from "@/lib/admin-campaign";
import { getAdminBulkEditProps } from "@/lib/admin-bulk-edit-props";
import { requireContributorAccess } from "@/lib/auth/require-contributor-access";
import { PressPublicationsAdmin } from "@/components/admin/press-publications-admin";

interface PageProps {
  searchParams: Promise<{ campaign?: string }>;
}

export default async function PressPublicationsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { campaignId } = await resolveAdminCampaignId(params.campaign);
  if (!campaignId) redirect("/admin/campaigns");
  await requireContributorAccess(campaignId, "activities");
  const [data, bulkProps] = await Promise.all([
    getAdminData(campaignId, ["activities"]),
    getAdminBulkEditProps(),
  ]);
  return (
    <PressPublicationsAdmin
      campaignId={campaignId}
      initialActivities={data.activities ?? []}
      contentPlans={data.settings?.contentPlans ?? []}
      contentTopics={data.settings?.contentTopics ?? []}
      isFullAdmin={bulkProps.isFullAdmin}
      canTransferOwnership={bulkProps.canTransferOwnership}
      users={bulkProps.users}
    />
  );
}
