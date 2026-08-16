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
} from "@/lib/company-supervision";
import { getAdminData } from "@/lib/data-access/admin";
import { buildLeaderboardSourceFromAdmin } from "@/lib/performance-overview";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ userKey: string }>;
  searchParams: Promise<{ campaign?: string }>;
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
      "videos",
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
    videos: data.videos,
    socialPosts: data.socialPosts,
    activities: data.activities,
    files: data.files,
  });

  const entries = buildUserLeaderboard(source);
  const entry = findUserLeaderboardEntry(entries, userKey);

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

  return (
    <CompanySupervisionAdmin
      campaignId={campaignId}
      campaignTitle={data.settings.title}
      campaignSlug={data.settings.slug}
      entry={entry}
      items={items}
      excelSource={toCompanyExcelSource(userSource)}
      canScore={canScoreContent(session)}
      canManageReviews={canManageAllContent(session)}
      canSendMessage={canSendContentMessages(session)}
    />
  );
}
