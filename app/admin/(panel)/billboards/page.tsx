import { redirect } from "next/navigation";
import { getAdminData } from "@/lib/data-access/admin";
import { resolveAdminCampaignId } from "@/lib/admin-campaign";
import { hasExternalBillboardConnection, resolveAdminBillboards } from "@/lib/billboards";
import { BillboardsAdmin } from "@/components/admin/billboards-admin";
import type { Billboard, CampaignSettings } from "@/lib/types";

interface PageProps {
  searchParams: Promise<{ campaign?: string }>;
}

export default async function BillboardsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { campaignId } = await resolveAdminCampaignId(params.campaign);
  if (!campaignId) redirect("/admin/campaigns");
  const data = await getAdminData(campaignId);
  const dbBillboards = (data.billboards ?? []) as Billboard[];
  const billboards = data.settings
    ? await resolveAdminBillboards(data.settings as CampaignSettings, dbBillboards)
    : dbBillboards;

  return (
    <BillboardsAdmin
      campaignId={campaignId}
      initialBillboards={billboards}
      liveApiEnabled={Boolean(
        data.settings && hasExternalBillboardConnection(data.settings as CampaignSettings)
      )}
    />
  );
}
