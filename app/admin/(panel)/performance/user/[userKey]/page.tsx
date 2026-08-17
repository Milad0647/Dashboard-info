import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CompanySupervisionAdmin } from "@/components/admin/company-supervision-admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { resolveAdminCampaignId } from "@/lib/admin-campaign";
import { listContentReviewsAction } from "@/lib/actions/content-review-actions";
import {
  canManageAllContent,
  canScoreContent,
  canSendContentMessages,
} from "@/lib/auth/access";
import { getAuthSession } from "@/lib/auth/get-session";
import { buildUserLeaderboard } from "@/lib/city-leaderboard";
import {
  collectCompanySupervisionItems,
  filterLeaderboardSourceByUser,
  findUserLeaderboardEntry,
  toCompanyExcelSource,
  zeroPeriodLeaderboardEntry,
  type CompanySupervisionContentType,
} from "@/lib/company-supervision";
import { contentPlansFromTopics } from "@/lib/content-topics";
import { getAdminData } from "@/lib/data-access/admin";
import { buildLeaderboardSourceFromAdmin } from "@/lib/performance-overview";
import {
  filterLeaderboardSourceForPerformance,
  getPerformancePeriodLabel,
  isPerformanceLeaderboardFilterActive,
  performanceFilterFromQuery,
  type PerformanceContentCategory,
} from "@/lib/performance-filters";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ userKey: string }>;
  searchParams: Promise<{
    campaign?: string;
    date?: string;
    from?: string;
    to?: string;
    category?: string;
    province?: string;
    city?: string;
    companyType?: string;
    region?: string;
    topics?: string;
  }>;
}

export default async function CompanySupervisionPage({
  params,
  searchParams,
}: PageProps) {
  const session = await getAuthSession();
  if (!session || !canScoreContent(session)) {
    redirect("/admin");
  }

  const { userKey: rawUserKey } = await params;
  const userKey = decodeURIComponent(rawUserKey || "").trim();
  if (!userKey) notFound();

  const query = await searchParams;
  const { campaignId } = await resolveAdminCampaignId(query.campaign);
  if (!campaignId) redirect("/admin/campaigns");

  const [data, reviewsResult] = await Promise.all([
    getAdminData(campaignId, [
      "settings",
      "billboards",
      "posters",
      "posterVersions",
      "videos",
      "videoVersions",
      "files",
      "socialPosts",
      "activities",
    ]),
    listContentReviewsAction({ campaignId }),
  ]);

  if (!data.settings) redirect("/admin/campaigns");

  const source = buildLeaderboardSourceFromAdmin({
    billboards: data.billboards,
    posters: data.posters,
    posterVersions: data.posterVersions,
    videos: data.videos,
    videoVersions: data.videoVersions,
    socialPosts: data.socialPosts,
    activities: data.activities,
    files: data.files,
  });

  const rankingFilter = performanceFilterFromQuery(query);
  const periodSource = filterLeaderboardSourceForPerformance(source, rankingFilter);
  const periodEntries = buildUserLeaderboard(periodSource);
  const allEntries = buildUserLeaderboard(source);
  const periodEntry = findUserLeaderboardEntry(periodEntries, userKey);
  const identity = findUserLeaderboardEntry(allEntries, userKey);
  const filterActive = isPerformanceLeaderboardFilterActive(rankingFilter);
  const entry = filterActive
    ? periodEntry
      ? {
          ...periodEntry,
          userName: identity?.userName ?? periodEntry.userName,
          province: identity?.province || periodEntry.province,
          city: identity?.city || periodEntry.city,
          companyType: identity?.companyType ?? periodEntry.companyType,
          region: identity?.region ?? periodEntry.region,
        }
      : identity
        ? zeroPeriodLeaderboardEntry(identity)
        : null
    : (identity ?? periodEntry);

  if (!entry) {
    const backHref = `/admin/performance?campaign=${encodeURIComponent(campaignId)}`;
    return (
      <Card dir="rtl">
        <CardContent className="flex flex-col items-center gap-4 p-10 text-center text-right">
          <p className="text-muted-foreground">
            کاربر یا شرکتی با این شناسه در کمپین فعلی یافت نشد.
          </p>
          <Button asChild>
            <Link href={backHref}>بازگشت به مشاهده عملکرد</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const items = collectCompanySupervisionItems({
    campaignId,
    userKey,
    source,
    reviews: reviewsResult.success ? reviewsResult.reviews ?? [] : [],
  });
  const userSource = filterLeaderboardSourceByUser(source, userKey);
  const contentPlans =
    data.settings.contentTopics && data.settings.contentTopics.length > 0
      ? contentPlansFromTopics(data.settings.contentTopics)
      : data.settings.contentPlans ?? [];

  return (
    <CompanySupervisionAdmin
      campaignId={campaignId}
      campaignTitle={data.settings.title}
      campaignSlug={data.settings.slug}
      entry={entry}
      items={items}
      excelSource={toCompanyExcelSource(userSource)}
      contentPlans={contentPlans}
      contentTopics={data.settings.contentTopics ?? []}
      canScore={canScoreContent(session)}
      canManageReviews={canManageAllContent(session)}
      canSendMessage={canSendContentMessages(session)}
      periodLabel={getPerformancePeriodLabel(rankingFilter)}
      initialContentType={contentTypeFromCategory(rankingFilter.contentCategory)}
      initialFilter={{
        datePreset: rankingFilter.datePreset,
        dateFrom: rankingFilter.dateFrom,
        dateTo: rankingFilter.dateTo,
        province: rankingFilter.province,
        city: rankingFilter.city,
        planLabels: rankingFilter.planLabels,
        companyType: rankingFilter.companyType,
      }}
    />
  );
}

function contentTypeFromCategory(
  category: PerformanceContentCategory
): CompanySupervisionContentType | "all" {
  if (category === "all") return "all";
  return category;
}
