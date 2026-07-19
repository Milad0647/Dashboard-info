import { RawMediaAdmin } from "@/components/admin/raw-media-admin";
import { getAdminData } from "@/lib/data-access/admin";
import { resolveAdminCampaignId } from "@/lib/admin-campaign";
import { getAdminBulkEditProps } from "@/lib/admin-bulk-edit-props";
import { canScoreContent } from "@/lib/auth/access";
import { getAuthSession } from "@/lib/auth/get-session";
import type { RawMediaUpload } from "@/lib/types";
import { redirect } from "next/navigation";

interface RawMediaPageProps {
  searchParams: Promise<{ campaign?: string }>;
}

export default async function RawMediaPage({ searchParams }: RawMediaPageProps) {
  const params = await searchParams;
  const { campaignId } = await resolveAdminCampaignId(params.campaign);

  if (!campaignId) redirect("/admin/campaigns");

  const session = await getAuthSession();
  const canScore = Boolean(session && canScoreContent(session));
  const [data, bulkProps] = await Promise.all([
    getAdminData(campaignId, ["rawMedia"]),
    getAdminBulkEditProps(),
  ]);
  if (!data.settings) redirect("/admin/campaigns");

  return (
    <RawMediaAdmin
      campaignId={campaignId}
      initialItems={(data.rawMedia ?? []) as RawMediaUpload[]}
      contentPlans={data.settings?.contentPlans ?? []}
      contentTopics={data.settings?.contentTopics ?? []}
      canScore={canScore}
      isFullAdmin={bulkProps.isFullAdmin}
      canTransferOwnership={bulkProps.canTransferOwnership}
      users={bulkProps.users}
    />
  );
}
