import { redirect } from "next/navigation";
import { getAdminData } from "@/lib/data-access/admin";
import { resolveAdminCampaignId } from "@/lib/admin-campaign";
import { requireContributorAccess } from "@/lib/auth/require-contributor-access";
import { SocialPostsAdmin } from "@/components/admin/social-posts-admin";

interface PageProps {
  searchParams: Promise<{ campaign?: string }>;
}

export default async function SocialPostsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { campaignId } = await resolveAdminCampaignId(params.campaign);
  if (!campaignId) redirect("/admin/campaigns");
  await requireContributorAccess(campaignId, "socialPosts");
  const data = await getAdminData(campaignId);
  return <SocialPostsAdmin campaignId={campaignId} initialPosts={data.socialPosts ?? []} />;
}
