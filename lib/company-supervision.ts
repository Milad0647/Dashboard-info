import {
  type LeaderboardSourceData,
  type UserLeaderboardEntry,
} from "@/lib/city-leaderboard";
import {
  buildContentMessageAdminPath,
  CONTENT_MESSAGE_TYPE_LABELS,
  type ContentMessageContentType,
} from "@/lib/content-messages/types";
import type { ContentReview, ContentReviewStatus } from "@/lib/content-review/types";
import { isReviewableContentType } from "@/lib/content-review/types";
import { countsAsTodayBillboardUpload } from "@/lib/billboards";
import {
  getSafeCreatedTimestamp,
  getTehranCalendarDateIso,
  isSameDay,
} from "@/lib/safe-dates";
import type { Billboard, Ownable } from "@/lib/types";

export type CompanySupervisionContentType = ContentMessageContentType;

export interface CompanySupervisionItem {
  key: string;
  contentType: CompanySupervisionContentType;
  contentId: string;
  title: string;
  typeLabel: string;
  thumbnailUrl: string | null;
  createdAt: string | null;
  score: number | null;
  autoScore: number | null;
  manualScore: number | null;
  published: boolean;
  adminPath: string;
  reviewStatus: ContentReviewStatus | null;
  rejectionReason: string | null;
  reviewUpdatedAt: string | null;
  everRejected: boolean;
  isToday: boolean;
  isReviewable: boolean;
}

function resolveUserKeyMatch(item: Ownable, userKey: string): boolean {
  if (item.ownerUserId && item.ownerUserId === userKey) return true;
  if (item.ownerEmail && item.ownerEmail === userKey) return true;
  if ((item.ownerName?.trim() || "کاربر") === userKey) return true;
  return false;
}

function isTodayItem(
  item: Ownable & { createdAt?: string | null },
  contentType: CompanySupervisionContentType
): boolean {
  if (contentType === "billboard") {
    return countsAsTodayBillboardUpload(item as unknown as Billboard);
  }
  return isSameDay(getSafeCreatedTimestamp(item), getTehranCalendarDateIso());
}

function reviewMapKey(contentType: string, contentId: string): string {
  return `${contentType}:${contentId}`;
}

export function collectCompanySupervisionItems(input: {
  campaignId: string;
  userKey: string;
  source: LeaderboardSourceData;
  reviews?: ContentReview[];
}): CompanySupervisionItem[] {
  const { campaignId, userKey, source } = input;
  const reviewsByKey = new Map(
    (input.reviews ?? []).map((review) => [
      reviewMapKey(review.contentType, review.contentId),
      review,
    ])
  );
  const items: CompanySupervisionItem[] = [];

  const push = <
    T extends Ownable & {
      id: string;
      title: string;
      createdAt?: string | null;
      published?: boolean;
    },
  >(
    list: T[],
    contentType: CompanySupervisionContentType,
    getThumb?: (item: T) => string | null | undefined
  ) => {
    for (const item of list) {
      if (!resolveUserKeyMatch(item, userKey)) continue;
      const review = reviewsByKey.get(reviewMapKey(contentType, item.id));
      const official =
        typeof item.score === "number" && Number.isFinite(item.score) ? item.score : null;
      const auto =
        typeof item.autoScore === "number" && Number.isFinite(item.autoScore)
          ? item.autoScore
          : null;
      const manual =
        typeof item.manualScore === "number" && Number.isFinite(item.manualScore)
          ? item.manualScore
          : null;

      items.push({
        key: `${contentType}:${item.id}`,
        contentType,
        contentId: item.id,
        title: item.title,
        typeLabel: CONTENT_MESSAGE_TYPE_LABELS[contentType] ?? contentType,
        thumbnailUrl: getThumb?.(item) ?? null,
        createdAt: item.createdAt ?? null,
        score: official && official > 0 ? official : null,
        autoScore: auto,
        manualScore: manual,
        published: Boolean(item.published),
        adminPath: buildContentMessageAdminPath(contentType, campaignId, item.id),
        reviewStatus: review?.status ?? null,
        rejectionReason: review?.rejectionReason ?? null,
        reviewUpdatedAt: review?.updatedAt ?? null,
        everRejected: Boolean(review?.everRejected),
        isToday: isTodayItem(item, contentType),
        isReviewable: isReviewableContentType(contentType),
      });
    }
  };

  if (source.sections.billboards) {
    push(source.billboards, "billboard", (item) => item.thumbnailUrl);
  }
  if (source.sections.posters) {
    push(source.posters as Array<Ownable & { id: string; title: string; published?: boolean }>, "poster");
  }
  if (source.sections.videos) {
    push(source.videos as Array<Ownable & { id: string; title: string; published?: boolean }>, "video");
  }
  if (source.sections.socialPosts) {
    push(source.socialPosts, "social_post", (item) => item.coverImageUrl);
  }
  if (source.sections.sitePublications) {
    push(source.sitePublications, "site_publication", (item) => item.coverImageUrl);
  }
  if (source.sections.activities) {
    push(source.activities, "activity", (item) => item.imageUrl);
    push(source.pressPublications, "activity", (item) => item.imageUrl);
  }
  if (source.sections.files) {
    push(source.files, "file");
  }

  return items.sort((a, b) => {
    const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
    const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
    return bTime - aTime;
  });
}

export function findUserLeaderboardEntry(
  entries: UserLeaderboardEntry[],
  userKey: string
): UserLeaderboardEntry | null {
  return entries.find((entry) => entry.userKey === userKey) ?? null;
}

export const COMPANY_SUPERVISION_TYPE_FILTERS: {
  value: CompanySupervisionContentType | "all";
  label: string;
}[] = [
  { value: "all", label: "همه" },
  { value: "billboard", label: "تبلیغات محیطی" },
  { value: "poster", label: "پوستر" },
  { value: "video", label: "ویدیو" },
  { value: "social_post", label: "شبکه اجتماعی" },
  { value: "site_publication", label: "انتشار سایت" },
  { value: "activity", label: "اقدام" },
  { value: "file", label: "فایل" },
];

export function reviewStatusLabel(status: ContentReviewStatus | null): string | null {
  if (status === "needs_revision") return "برگشت برای ویرایش";
  if (status === "resubmitted") return "ارسال‌مجدد (ویرایش شده)";
  if (status === "approved") return "تاییدشده";
  return null;
}
