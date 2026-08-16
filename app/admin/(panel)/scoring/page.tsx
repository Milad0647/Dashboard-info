import { redirect } from "next/navigation";
import { getAdminData } from "@/lib/data-access/admin";
import { resolveAdminCampaignId } from "@/lib/admin-campaign";
import { ScoringHub } from "@/components/admin/scoring-hub";
import { canScoreContent } from "@/lib/auth/access";
import { getAuthSession } from "@/lib/auth/get-session";

interface PageProps {
  searchParams: Promise<{ campaign?: string }>;
}

export default async function ScoringRulesPage({ searchParams }: PageProps) {
  const session = await getAuthSession();
  if (!session || !canScoreContent(session)) {
    redirect("/admin");
  }

  const params = await searchParams;
  const { campaignId } = await resolveAdminCampaignId(params.campaign);
  if (!campaignId) redirect("/admin/campaigns");
  const data = await getAdminData(campaignId, [
    "settings",
    "posterCategories",
    "videoCategories",
  ]);
  if (!data.settings) redirect("/admin/campaigns");

  return (
    <ScoringHub
      initialSettings={data.settings}
      posterCategories={data.posterCategories ?? []}
      videoCategories={data.videoCategories ?? []}
    />
  );
}
