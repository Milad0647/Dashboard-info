import { redirect } from "next/navigation";
import { canAccessNotifications, canScoreContent } from "@/lib/auth/access";
import { getAuthSession, isFullAdmin } from "@/lib/auth/get-session";
import { resolveAdminCampaignId } from "@/lib/admin-campaign";
import { getAdminData } from "@/lib/data-access/admin";
import { NotificationsAdmin } from "@/components/admin/notifications-admin";
import { listContentReviewsAction } from "@/lib/actions/content-review-actions";

interface PageProps {
  searchParams: Promise<{ campaign?: string }>;
}

export default async function ElanhaPage({ searchParams }: PageProps) {
  const session = await getAuthSession();
  if (!session) redirect("/admin/login");
  if (!canAccessNotifications(session)) redirect("/admin");

  const params = await searchParams;
  const { campaignId } = await resolveAdminCampaignId(params.campaign);
  if (!campaignId) redirect("/admin/campaigns");

  const data = await getAdminData(campaignId, [
    "posters",
    "videos",
    "billboards",
    "activities",
    "socialPosts",
    "posterVersions",
    "videoVersions",
  ]);
  const isAdmin = isFullAdmin(session);
  const canScore = canScoreContent(session);
  const reviewsResult = await listContentReviewsAction({
    campaignId,
    statuses: ["needs_revision", "resubmitted", "approved"],
  });

  return (
    <NotificationsAdmin
      campaignId={campaignId}
      isAdmin={isAdmin}
      canScore={canScore}
      posters={data.posters ?? []}
      videos={data.videos ?? []}
      billboards={data.billboards ?? []}
      activities={data.activities ?? []}
      socialPosts={data.socialPosts ?? []}
      posterVersions={data.posterVersions ?? []}
      videoVersions={data.videoVersions ?? []}
      contentReviews={reviewsResult.success ? (reviewsResult.reviews ?? []) : []}
      canManageReviews={Boolean(reviewsResult.success && reviewsResult.canManage)}
      contentTopics={data.settings?.contentTopics ?? []}
      contentPlans={data.settings?.contentPlans ?? []}
    />
  );
}
