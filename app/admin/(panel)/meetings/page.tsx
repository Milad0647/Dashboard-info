import { redirect } from "next/navigation";
import { getAdminData } from "@/lib/data-access/admin";
import { resolveAdminCampaignId } from "@/lib/admin-campaign";
import { getAdminBulkEditProps } from "@/lib/admin-bulk-edit-props";
import { requireContributorAccess } from "@/lib/auth/require-contributor-access";
import { MeetingsAdmin } from "@/components/admin/meetings-admin";

interface PageProps {
  searchParams: Promise<{ campaign?: string }>;
}

export default async function MeetingsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { campaignId } = await resolveAdminCampaignId(params.campaign);
  if (!campaignId) redirect("/admin/campaigns");
  await requireContributorAccess(campaignId, "meetings");
  const [data, bulkProps] = await Promise.all([
    getAdminData(campaignId, ["meetings"]),
    getAdminBulkEditProps(),
  ]);
  return (
    <MeetingsAdmin
      campaignId={campaignId}
      initialMeetings={data.meetings ?? []}
      hasMeetingsPassword={Boolean(data.settings?.meetingsViewPasswordHash)}
      contentPlans={data.settings?.contentPlans ?? []}
      isFullAdmin={bulkProps.isFullAdmin}
      canTransferOwnership={bulkProps.canTransferOwnership}
      users={bulkProps.users}
    />
  );
}
