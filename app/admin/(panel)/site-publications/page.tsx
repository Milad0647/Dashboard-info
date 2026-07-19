import { redirect } from "next/navigation";
import { getAdminData } from "@/lib/data-access/admin";
import { resolveAdminCampaignId } from "@/lib/admin-campaign";
import { getAdminBulkEditProps } from "@/lib/admin-bulk-edit-props";
import { requireContributorAccess } from "@/lib/auth/require-contributor-access";
import { canScoreContent } from "@/lib/auth/access";
import { getAuthSession } from "@/lib/auth/get-session";
import { SitePublicationsAdmin } from "@/components/admin/site-publications-admin";

interface PageProps {
  searchParams: Promise<{ campaign?: string }>;
}

export default async function SitePublicationsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const { campaignId } = await resolveAdminCampaignId(params.campaign);
  if (!campaignId) redirect("/admin/campaigns");
  await requireContributorAccess(campaignId, "sitePublications");
  const session = await getAuthSession();
  const canScore = Boolean(session && canScoreContent(session));
  const [data, bulkProps] = await Promise.all([
    getAdminData(campaignId, ["socialPosts"]),
    getAdminBulkEditProps(),
  ]);
  return (
    <SitePublicationsAdmin
      campaignId={campaignId}
      initialPosts={data.socialPosts ?? []}
      contentPlans={data.settings?.contentPlans ?? []}
      contentTopics={data.settings?.contentTopics ?? []}
      canScore={canScore}
      isFullAdmin={bulkProps.isFullAdmin}
      canTransferOwnership={bulkProps.canTransferOwnership}
      users={bulkProps.users}
    />
  );
}
