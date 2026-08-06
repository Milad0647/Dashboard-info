import { redirect } from "next/navigation";
import { ReturnedContentAdmin } from "@/components/admin/returned-content-admin";
import { resolveAdminCampaignId } from "@/lib/admin-campaign";
import { getAuthSession } from "@/lib/auth/get-session";
import { buildContentMessageAdminPath } from "@/lib/content-messages/types";
import { listContentReviewsAction } from "@/lib/actions/content-review-actions";
import { getAdminData } from "@/lib/data-access/admin";
import type { ReviewableContentType } from "@/lib/content-review/types";

type ReturnedContentItem = {
  reviewId: string;
  campaignId: string;
  contentType: ReviewableContentType;
  contentId: string;
  title: string;
  ownerName: string | null;
  ownerProvince: string | null;
  ownerCity: string | null;
  status: "needs_revision" | "resubmitted" | "approved";
  rejectionReason: string | null;
  updatedAt: string;
  adminPath: string;
};

export default async function ReturnedContentPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string }>;
}) {
  const session = await getAuthSession();
  if (!session) redirect("/admin/login");

  const params = await searchParams;
  const { campaignId } = await resolveAdminCampaignId(params.campaign);
  if (!campaignId) redirect("/admin/campaigns");

  const [reviewsResult, data] = await Promise.all([
    listContentReviewsAction({
      campaignId,
      statuses: ["needs_revision", "resubmitted"],
    }),
    getAdminData(campaignId, [
      "billboards",
      "posters",
      "videos",
      "activities",
      "socialPosts",
    ]),
  ]);

  const index = new Map<string, ReturnedContentItem>();
  for (const row of data.billboards ?? []) {
    index.set(`billboard:${row.id}`, {
      reviewId: "",
      campaignId,
      contentType: "billboard",
      contentId: row.id,
      title: row.title,
      ownerName: row.ownerName ?? null,
      ownerProvince: row.ownerProvince ?? row.province ?? null,
      ownerCity: row.ownerCity ?? row.city ?? null,
      status: "needs_revision",
      rejectionReason: null,
      updatedAt: row.updatedAt,
      adminPath: buildContentMessageAdminPath("billboard", campaignId, row.id),
    });
  }
  for (const row of data.posters ?? []) {
    index.set(`poster:${row.id}`, {
      reviewId: "",
      campaignId,
      contentType: "poster",
      contentId: row.id,
      title: row.title,
      ownerName: row.ownerName ?? null,
      ownerProvince: row.ownerProvince ?? null,
      ownerCity: row.ownerCity ?? null,
      status: "needs_revision",
      rejectionReason: null,
      updatedAt: row.updatedAt,
      adminPath: buildContentMessageAdminPath("poster", campaignId, row.id),
    });
  }
  for (const row of data.videos ?? []) {
    index.set(`video:${row.id}`, {
      reviewId: "",
      campaignId,
      contentType: "video",
      contentId: row.id,
      title: row.title,
      ownerName: row.ownerName ?? null,
      ownerProvince: row.ownerProvince ?? null,
      ownerCity: row.ownerCity ?? null,
      status: "needs_revision",
      rejectionReason: null,
      updatedAt: row.updatedAt,
      adminPath: buildContentMessageAdminPath("video", campaignId, row.id),
    });
  }
  for (const row of data.activities ?? []) {
    index.set(`activity:${row.id}`, {
      reviewId: "",
      campaignId,
      contentType: "activity",
      contentId: row.id,
      title: row.title,
      ownerName: row.ownerName ?? null,
      ownerProvince: row.ownerProvince ?? null,
      ownerCity: row.ownerCity ?? null,
      status: "needs_revision",
      rejectionReason: null,
      updatedAt: row.updatedAt,
      adminPath: buildContentMessageAdminPath("activity", campaignId, row.id),
    });
  }
  for (const row of data.socialPosts ?? []) {
    const type: ReviewableContentType = row.platform === "site" ? "site_publication" : "social_post";
    index.set(`${type}:${row.id}`, {
      reviewId: "",
      campaignId,
      contentType: type,
      contentId: row.id,
      title: row.title,
      ownerName: row.ownerName ?? null,
      ownerProvince: row.ownerProvince ?? null,
      ownerCity: row.ownerCity ?? null,
      status: "needs_revision",
      rejectionReason: null,
      updatedAt: row.updatedAt,
      adminPath: buildContentMessageAdminPath(type, campaignId, row.id),
    });
  }

  const items: ReturnedContentItem[] =
    reviewsResult.success && reviewsResult.reviews
      ? reviewsResult.reviews
          .map((review) => {
            const base = index.get(`${review.contentType}:${review.contentId}`);
            if (!base) return null;
            return {
              ...base,
              reviewId: review.id,
              status: review.status,
              rejectionReason: review.rejectionReason,
              updatedAt: review.updatedAt,
            };
          })
          .filter((item): item is ReturnedContentItem => Boolean(item))
      : [];

  return (
    <ReturnedContentAdmin
      campaignId={campaignId}
      items={items}
      canManage={Boolean(reviewsResult.success && reviewsResult.canManage)}
    />
  );
}
