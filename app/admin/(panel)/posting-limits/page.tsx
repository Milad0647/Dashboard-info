import { redirect } from "next/navigation";
import { getAdminData } from "@/lib/data-access/admin";
import { resolveAdminCampaignId } from "@/lib/admin-campaign";
import { PostingLimitsAdmin } from "@/components/admin/posting-limits-admin";
import { canManagePostingLimits } from "@/lib/auth/access";
import { getAuthSession } from "@/lib/auth/get-session";

interface PageProps {
  searchParams: Promise<{ campaign?: string }>;
}

export default async function PostingLimitsPage({ searchParams }: PageProps) {
  const session = await getAuthSession();
  if (!session || !canManagePostingLimits(session)) {
    redirect("/admin");
  }

  const params = await searchParams;
  const { campaignId } = await resolveAdminCampaignId(params.campaign);
  if (!campaignId) redirect("/admin/campaigns");
  const data = await getAdminData(campaignId, ["settings"]);
  if (!data.settings) redirect("/admin/campaigns");

  return <PostingLimitsAdmin initialSettings={data.settings} />;
}
