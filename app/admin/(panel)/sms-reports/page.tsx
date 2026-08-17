import { redirect } from "next/navigation";
import { getAdminData } from "@/lib/data-access/admin";
import { resolveAdminCampaignId } from "@/lib/admin-campaign";
import { getAdminBulkEditProps } from "@/lib/admin-bulk-edit-props";
import { requireContributorAccess } from "@/lib/auth/require-contributor-access";
import { SmsReportsAdmin } from "@/components/admin/sms-reports-admin";

interface PageProps {
  searchParams: Promise<{ campaign?: string }>;
}

export default async function SmsReportsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { campaignId } = await resolveAdminCampaignId(params.campaign);
  if (!campaignId) redirect("/admin/campaigns");
  await requireContributorAccess(campaignId, "smsReports");
  const [data, bulkProps] = await Promise.all([
    getAdminData(campaignId, ["smsReports"]),
    getAdminBulkEditProps(),
  ]);
  return (
    <SmsReportsAdmin
      campaignId={campaignId}
      initialReports={data.smsReports ?? []}
      isFullAdmin={bulkProps.isFullAdmin}
      canTransferOwnership={bulkProps.canTransferOwnership}
      users={bulkProps.users}
    />
  );
}
