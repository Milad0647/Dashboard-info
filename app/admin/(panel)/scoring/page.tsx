import { redirect } from "next/navigation";
import { getAdminData } from "@/lib/data-access/admin";
import { resolveAdminCampaignId } from "@/lib/admin-campaign";
import { ScoringPolicyAdmin } from "@/components/admin/scoring-policy-admin";
import { ScoringRulesAdmin } from "@/components/admin/scoring-rules-admin";
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
    <div className="space-y-6 max-w-4xl">
      <ScoringPolicyAdmin initialSettings={data.settings} />
      <ScoringRulesAdmin
        initialSettings={data.settings}
        posterCategories={data.posterCategories ?? []}
        videoCategories={data.videoCategories ?? []}
      />
    </div>
  );
}
