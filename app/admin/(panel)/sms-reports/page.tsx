import { redirect } from "next/navigation";
import { getAdminData } from "@/lib/data-access/admin";
import { resolveAdminCampaignId } from "@/lib/admin-campaign";
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
  const data = await getAdminData(campaignId, ["smsReports"]);
  return <SmsReportsAdmin campaignId={campaignId} initialReports={data.smsReports ?? []} />;
}
