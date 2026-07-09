import { redirect } from "next/navigation";
import { getAuthSession, isFullAdmin } from "@/lib/auth/get-session";
import { resolveAdminCampaignId } from "@/lib/admin-campaign";
import { getAdminData } from "@/lib/data-access/admin";
import { NotificationsAdmin } from "@/components/admin/notifications-admin";

interface PageProps {
  searchParams: Promise<{ campaign?: string }>;
}

export default async function ElanhaPage({ searchParams }: PageProps) {
  const session = await getAuthSession();
  if (!session) redirect("/admin/login");

  const params = await searchParams;
  const { campaignId } = await resolveAdminCampaignId(params.campaign);
  if (!campaignId) redirect("/admin/campaigns");

  const data = await getAdminData(campaignId);
  const isAdmin = isFullAdmin(session);

  return (
    <NotificationsAdmin
      campaignId={campaignId}
      isAdmin={isAdmin}
      posters={data.posters ?? []}
      videos={data.videos ?? []}
      billboards={data.billboards ?? []}
      activities={data.activities ?? []}
      socialPosts={data.socialPosts ?? []}
      posterVersions={data.posterVersions ?? []}
      videoVersions={data.videoVersions ?? []}
    />
  );
}
