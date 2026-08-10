import { redirect } from "next/navigation";
import { getAdminData } from "@/lib/data-access/admin";
import { resolveAdminCampaignId } from "@/lib/admin-campaign";
import { getAdminBulkEditProps } from "@/lib/admin-bulk-edit-props";
import { requireContributorAccess } from "@/lib/auth/require-contributor-access";
import { SubmissionsAdmin } from "@/components/admin/submissions-admin";

interface PageProps {
  searchParams: Promise<{ campaign?: string }>;
}

export default async function SubmissionsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { campaignId } = await resolveAdminCampaignId(params.campaign);
  if (!campaignId) redirect("/admin/campaigns");
  await requireContributorAccess(campaignId, "submissions");
  const [data, bulkProps] = await Promise.all([
    getAdminData(campaignId, ["submissions"]),
    getAdminBulkEditProps(),
  ]);
  return (
    <SubmissionsAdmin
      campaignId={campaignId}
      initialSubmissions={data.submissions}
      contentPlans={data.settings?.contentPlans ?? []}
      isFullAdmin={bulkProps.isFullAdmin}
      canTransferOwnership={bulkProps.canTransferOwnership}
      users={bulkProps.users}
    />
  );
}
