import { redirect } from "next/navigation";
import { getAdminData } from "@/lib/data-access/admin";
import { resolveAdminCampaignId } from "@/lib/admin-campaign";
import { requireContributorAccess } from "@/lib/auth/require-contributor-access";
import { getAuthSession, isFullAdmin } from "@/lib/auth/get-session";
import { SocialHubAdmin } from "@/components/admin/social-hub-admin";

interface PageProps {
  searchParams: Promise<{ campaign?: string }>;
}

export default async function SocialPostsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { campaignId } = await resolveAdminCampaignId(params.campaign);
  if (!campaignId) redirect("/admin/campaigns");
  await requireContributorAccess(campaignId, "socialPosts");
  const session = await getAuthSession();
  const fullAdmin = session ? isFullAdmin(session) : true;
  const data = await getAdminData(campaignId);
  return (
    <SocialHubAdmin
      campaignId={campaignId}
      initialPosts={data.socialPosts ?? []}
      initialPlatformStats={data.socialPlatformStats ?? []}
      isFullAdmin={fullAdmin}
    />
  );
}
