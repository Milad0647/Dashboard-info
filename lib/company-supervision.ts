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
import type { ContentMixItem } from "@/lib/campaign-overview-insights";
import { countsAsTodayBillboardUpload } from "@/lib/billboards";
import {
  getSafeCreatedTimestamp,
  getTehranCalendarDateIso,
  getTehranOffsetDateIso,
  isSameDay,
  timestampToTehranDateIso,
} from "@/lib/safe-dates";
import type {
  Billboard,
  CampaignActivity,
  CampaignFile,
  Ownable,
  Poster,
  SocialMediaPost,
  Video,
} from "@/lib/types";
import type {
  UploadActivityPoint,
  UploadActivitySummary,
} from "@/lib/upload-activity-stats";

export type CompanySupervisionContentType = ContentMessageContentType;

export type CompanySupervisionDatePreset = "all" | "today" | "7d" | "30d";

export type CompanySupervisionReviewFilter =
  | "all"
  | "none"
  | "needs_revision"
  | "resubmitted"
  | "approved"
  | "ever_rejected";

export interface CompanySupervisionItem {
  key: string;
  contentType: CompanySupervisionContentType;
  contentId: string;
  title: string;
  description: string | null;
  typeLabel: string;
  thumbnailUrl: string | null;
  imageUrl: string | null;
  createdAt: string | null;
  score: number | null;
  autoScore: number | null;
  manualScore: number | null;
  published: boolean;
  adminPath: string;
  reviewStatus: ContentReviewStatus | null;
  rejectionReason: string | null;
  reviewUpdatedAt: string | null;
  rejectedAt: string | null;
  resubmittedAt: string | null;
  resolvedAt: string | null;
  everRejected: boolean;
  isToday: boolean;
  isReviewable: boolean;
  city: string | null;
  province: string | null;
  planLabel: string | null;
}

export function resolveUserKeyMatch(item: Ownable, userKey: string): boolean {
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
      description?: string | null;
      createdAt?: string | null;
      published?: boolean;
      city?: string | null;
      province?: string | null;
      planLabel?: string | null;
      imageUrl?: string | null;
      thumbnailUrl?: string | null;
      coverImageUrl?: string | null;
    },
  >(
    list: T[],
    contentType: CompanySupervisionContentType,
    getThumb?: (item: T) => string | null | undefined,
    getImage?: (item: T) => string | null | undefined
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
      const thumb = getThumb?.(item) ?? item.thumbnailUrl ?? item.coverImageUrl ?? null;
      const image =
        getImage?.(item) ?? item.imageUrl ?? item.coverImageUrl ?? thumb ?? null;

      items.push({
        key: `${contentType}:${item.id}`,
        contentType,
        contentId: item.id,
        title: item.title,
        description: item.description ?? null,
        typeLabel: CONTENT_MESSAGE_TYPE_LABELS[contentType] ?? contentType,
        thumbnailUrl: thumb,
        imageUrl: image,
        createdAt: item.createdAt ?? null,
        score: official && official > 0 ? official : null,
        autoScore: auto,
        manualScore: manual,
        published: Boolean(item.published),
        adminPath: buildContentMessageAdminPath(contentType, campaignId, item.id),
        reviewStatus: review?.status ?? null,
        rejectionReason: review?.rejectionReason ?? null,
        reviewUpdatedAt: review?.updatedAt ?? null,
        rejectedAt: review?.rejectedAt ?? null,
        resubmittedAt: review?.resubmittedAt ?? null,
        resolvedAt: review?.resolvedAt ?? null,
        everRejected: Boolean(review?.everRejected),
        isToday: isTodayItem(item, contentType),
        isReviewable: isReviewableContentType(contentType),
        city: item.city ?? item.ownerCity ?? null,
        province: item.province ?? item.ownerProvince ?? null,
        planLabel: item.planLabel ?? null,
      });
    }
  };

  if (source.sections.billboards) {
    push(
      source.billboards,
      "billboard",
      (item) => item.thumbnailUrl,
      (item) => item.imageUrl || item.thumbnailUrl
    );
  }
  if (source.sections.posters) {
    push(source.posters as Array<Ownable & { id: string; title: string; published?: boolean }>, "poster");
  }
  if (source.sections.videos) {
    push(source.videos as Array<Ownable & { id: string; title: string; published?: boolean }>, "video");
  }
  if (source.sections.socialPosts) {
    push(
      source.socialPosts,
      "social_post",
      (item) => item.coverImageUrl,
      (item) => item.mediaUrl || item.coverImageUrl
    );
  }
  if (source.sections.sitePublications) {
    push(
      source.sitePublications,
      "site_publication",
      (item) => item.coverImageUrl,
      (item) => item.mediaUrl || item.coverImageUrl
    );
  }
  if (source.sections.activities) {
    push(
      source.activities,
      "activity",
      (item) => item.imageUrl,
      (item) => item.imageUrl
    );
    push(
      source.pressPublications,
      "activity",
      (item) => item.imageUrl,
      (item) => item.imageUrl
    );
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

export function filterLeaderboardSourceByUser(
  source: LeaderboardSourceData,
  userKey: string
): LeaderboardSourceData {
  const keep = <T extends Ownable>(list: T[]) =>
    list.filter((item) => resolveUserKeyMatch(item, userKey));

  return {
    ...source,
    billboards: keep(source.billboards),
    posters: keep(source.posters),
    videos: keep(source.videos),
    socialPosts: keep(source.socialPosts),
    sitePublications: keep(source.sitePublications),
    activities: keep(source.activities),
    pressPublications: keep(source.pressPublications),
    files: keep(source.files),
  };
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

export const COMPANY_SUPERVISION_DATE_PRESETS: {
  value: CompanySupervisionDatePreset;
  label: string;
}[] = [
  { value: "all", label: "همه تاریخ‌ها" },
  { value: "today", label: "امروز" },
  { value: "7d", label: "۷ روز اخیر" },
  { value: "30d", label: "۳۰ روز اخیر" },
];

export const COMPANY_SUPERVISION_REVIEW_FILTERS: {
  value: CompanySupervisionReviewFilter;
  label: string;
}[] = [
  { value: "all", label: "همه وضعیت‌ها" },
  { value: "none", label: "بدون بازبینی" },
  { value: "needs_revision", label: "برگشت برای ویرایش" },
  { value: "resubmitted", label: "ارسال‌مجدد" },
  { value: "approved", label: "تاییدشده" },
  { value: "ever_rejected", label: "حداقل یک‌بار رد شده" },
];

export function reviewStatusLabel(status: ContentReviewStatus | null): string | null {
  if (status === "needs_revision") return "برگشت برای ویرایش";
  if (status === "resubmitted") return "ارسال‌مجدد (ویرایش شده)";
  if (status === "approved") return "تاییدشده";
  return null;
}

function matchesDatePreset(
  item: CompanySupervisionItem,
  preset: CompanySupervisionDatePreset
): boolean {
  if (preset === "all") return true;
  if (preset === "today") return item.isToday;
  const day = timestampToTehranDateIso(item.createdAt);
  if (!day) return false;
  const oldest =
    preset === "7d" ? getTehranOffsetDateIso(-6) : getTehranOffsetDateIso(-29);
  return day >= oldest;
}

function matchesReviewFilter(
  item: CompanySupervisionItem,
  filter: CompanySupervisionReviewFilter
): boolean {
  if (filter === "all") return true;
  if (filter === "none") return item.reviewStatus == null;
  if (filter === "ever_rejected") return item.everRejected;
  return item.reviewStatus === filter;
}

export function filterCompanySupervisionItems(
  items: CompanySupervisionItem[],
  options: {
    datePreset?: CompanySupervisionDatePreset;
    contentType?: CompanySupervisionContentType | "all";
    reviewFilter?: CompanySupervisionReviewFilter;
  }
): CompanySupervisionItem[] {
  const datePreset = options.datePreset ?? "all";
  const contentType = options.contentType ?? "all";
  const reviewFilter = options.reviewFilter ?? "all";

  return items.filter((item) => {
    if (contentType !== "all" && item.contentType !== contentType) return false;
    if (!matchesDatePreset(item, datePreset)) return false;
    if (!matchesReviewFilter(item, reviewFilter)) return false;
    return true;
  });
}

export function groupCompanySupervisionItems(
  items: CompanySupervisionItem[]
): { type: CompanySupervisionContentType; label: string; items: CompanySupervisionItem[] }[] {
  const order = COMPANY_SUPERVISION_TYPE_FILTERS.filter(
    (option): option is { value: CompanySupervisionContentType; label: string } =>
      option.value !== "all"
  );

  return order
    .map((option) => ({
      type: option.value,
      label: option.label,
      items: items.filter((item) => item.contentType === option.value),
    }))
    .filter((group) => group.items.length > 0);
}

export function countTodayByContentType(
  items: CompanySupervisionItem[]
): Partial<Record<CompanySupervisionContentType, number>> {
  const counts: Partial<Record<CompanySupervisionContentType, number>> = {};
  for (const item of items) {
    if (!item.isToday) continue;
    counts[item.contentType] = (counts[item.contentType] ?? 0) + 1;
  }
  return counts;
}

export function buildCompanyContentMix(entry: UserLeaderboardEntry): ContentMixItem[] {
  return [
    { label: "تبلیغات محیطی", count: entry.billboards },
    { label: "پوستر", count: entry.posters },
    { label: "ویدیو", count: entry.videos },
    { label: "پست اجتماعی", count: entry.socialPosts },
    { label: "انتشار سایت", count: entry.sitePublications },
    { label: "اقدام", count: entry.activities },
    { label: "فایل", count: entry.files },
  ].filter((item) => item.count > 0);
}

function emptyUploadPoint(date: string): UploadActivityPoint {
  return {
    date,
    total: 0,
    posters: 0,
    videos: 0,
    billboards: 0,
    socialPosts: 0,
    sitePublications: 0,
    activities: 0,
    broadcastReports: 0,
    meetings: 0,
    files: 0,
  };
}

function uploadFieldForType(
  contentType: CompanySupervisionContentType
): Exclude<keyof UploadActivityPoint, "date" | "total"> | null {
  switch (contentType) {
    case "billboard":
      return "billboards";
    case "poster":
      return "posters";
    case "video":
      return "videos";
    case "social_post":
      return "socialPosts";
    case "site_publication":
      return "sitePublications";
    case "activity":
      return "activities";
    case "file":
      return "files";
    default:
      return null;
  }
}

export function buildCompanyUploadActivityStats(
  items: CompanySupervisionItem[],
  days = 14
): UploadActivitySummary {
  const buckets = new Map<string, UploadActivityPoint>();

  for (const item of items) {
    const date = timestampToTehranDateIso(item.createdAt);
    if (!date) continue;
    const field = uploadFieldForType(item.contentType);
    if (!field) continue;
    const point = buckets.get(date) ?? emptyUploadPoint(date);
    point[field]++;
    point.total++;
    buckets.set(date, point);
  }

  const today = getTehranOffsetDateIso(0);
  const yesterday = getTehranOffsetDateIso(-1);
  const series: UploadActivityPoint[] = [];
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = getTehranOffsetDateIso(-index);
    series.push(buckets.get(date) ?? emptyUploadPoint(date));
  }

  return {
    today: buckets.get(today)?.total ?? 0,
    yesterday: buckets.get(yesterday)?.total ?? 0,
    last7Days: series.slice(-7).reduce((sum, point) => sum + point.total, 0),
    series,
  };
}

export type CompanyExcelSource = {
  billboards: Billboard[];
  posters: Poster[];
  videos: Video[];
  socialPosts: SocialMediaPost[];
  sitePublications: SocialMediaPost[];
  activities: CampaignActivity[];
  pressPublications: CampaignActivity[];
  files: CampaignFile[];
};

export function toCompanyExcelSource(source: LeaderboardSourceData): CompanyExcelSource {
  return {
    billboards: source.billboards,
    posters: source.posters as Poster[],
    videos: source.videos as Video[],
    socialPosts: source.socialPosts,
    sitePublications: source.sitePublications,
    activities: source.activities,
    pressPublications: source.pressPublications,
    files: source.files,
  };
}
