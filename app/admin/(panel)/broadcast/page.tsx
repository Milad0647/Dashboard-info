import { redirect } from "next/navigation";
import { getAdminData } from "@/lib/data-access/admin";
import { resolveAdminCampaignId } from "@/lib/admin-campaign";
import { requireContributorAccess } from "@/lib/auth/require-contributor-access";
import { BroadcastAdmin } from "@/components/admin/broadcast-admin";

interface PageProps {
  searchParams: Promise<{ campaign?: string }>;
}

export default async function BroadcastPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { campaignId } = await resolveAdminCampaignId(params.campaign);
  if (!campaignId) redirect("/admin/campaigns");
  await requireContributorAccess(campaignId, "broadcast");
  const data = await getAdminData(campaignId);
  return <BroadcastAdmin campaignId={campaignId} initialReports={data.broadcastReports ?? []} />;
}
