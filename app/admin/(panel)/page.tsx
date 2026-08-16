import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderKanban, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminDashboardFilteredStats } from "@/components/admin/admin-dashboard-filtered-stats";
import { DashboardDirectivesPanel } from "@/components/admin/dashboard-directives-panel";
import { EditSuggestionsPanel } from "@/components/admin/edit-suggestions-panel";
import { getAdminData, getAllUsers } from "@/lib/data-access/admin";
import { resolveAdminCampaignId } from "@/lib/admin-campaign";
import { DASHBOARD_STAT_DEFINITIONS } from "@/lib/admin-dashboard-stats";
import { resolveAdminBillboards } from "@/lib/billboards";
import type { Billboard, CampaignSettings } from "@/lib/types";
import { CampaignTools } from "@/components/admin/campaign-tools";
import { canManageAllContent, canManageDirectives, isClientUser } from "@/lib/auth/access";
import { getAuthSession, getOwnerFilter, isFullAdmin } from "@/lib/auth/get-session";
import {
  defaultContributorPermissions,
  hasContributorPermission,
  type ContributorPermissions,
} from "@/lib/contributor-permissions";
import { pgListDirectivesForUserInbox } from "@/lib/db/repository-directives";
import { pgGetUserPermissionsForCampaign } from "@/lib/db/repository-extended";
import { buildEditSuggestions } from "@/lib/edit-suggestions";
import { withFileAccessTokensDeep } from "@/lib/uploads";
import { adminHref, isPostgresConfigured } from "@/lib/utils";
import { MyScoreSummary } from "@/components/admin/my-score-summary";
import { buildUserLeaderboard } from "@/lib/city-leaderboard";
import { buildLeaderboardSourceFromAdmin } from "@/lib/performance-overview";

interface AdminDashboardProps {
  searchParams: Promise<{ campaign?: string }>;
}

export default async function AdminDashboardPage({ searchParams }: AdminDashboardProps) {
  const params = await searchParams;
  const session = await getAuthSession();
  const canManageAll = Boolean(session && isFullAdmin(session));
  const canOverseeAllContent = Boolean(session && canManageAllContent(session));
  const { campaignId } = await resolveAdminCampaignId(params.campaign);

  if (!campaignId) {
    if (canManageAll) redirect("/admin/campaigns");
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">داشبورد</h1>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            کمپینی برای حساب شما تعریف نشده است. با مدیر تماس بگیرید.
          </CardContent>
        </Card>
      </div>
    );
  }

  const data = await getAdminData(campaignId);
  if (!data.settings) {
    if (canManageAll) redirect("/admin/campaigns");
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">داشبورد</h1>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            کمپین انتخاب‌شده در دسترس نیست. با مدیر تماس بگیرید.
          </CardContent>
        </Card>
      </div>
    );
  }
  const ownerUserId = session ? getOwnerFilter(session) : undefined;

  const features = data.settings.features;
  let contributorPermissions: ContributorPermissions | null = null;
  if (!canOverseeAllContent && session?.userId) {
    contributorPermissions =
      (await pgGetUserPermissionsForCampaign(session.userId, campaignId)) ??
      defaultContributorPermissions();
  }

  const users = await getAllUsers();
  const billboards = data.settings
    ? await resolveAdminBillboards(
        data.settings as CampaignSettings,
        (data.billboards ?? []) as Billboard[],
        users,
        ownerUserId
      )
    : [];

  const completenessInput = {
    campaignId,
    ownerUserId: canOverseeAllContent ? undefined : session?.userId,
    posters: data.posters,
    posterVersions: data.posterVersions,
    videos: data.videos,
    videoVersions: data.videoVersions,
    socialPosts: data.socialPosts ?? [],
    billboards,
    files: data.files ?? [],
    rawMedia: data.rawMedia ?? [],
    broadcastReports: data.broadcastReports ?? [],
    meetings: data.meetings ?? [],
    activities: data.activities ?? [],
  };

  const editSuggestions = session?.userId
    ? buildEditSuggestions({
        ...completenessInput,
        ownerUserId: session.userId,
      })
    : [];

  const visibleStatHrefs = DASHBOARD_STAT_DEFINITIONS.filter((definition) =>
    canOverseeAllContent
      ? features[definition.featureKey]
      : hasContributorPermission(contributorPermissions, definition.permissionKey)
  ).map((definition) => definition.href);

  const showBillboardCategoryChart = canOverseeAllContent
    ? features.billboards
    : hasContributorPermission(contributorPermissions, "billboards");
  const showSubmissionsAlert = canOverseeAllContent
    ? features.submissions
    : hasContributorPermission(contributorPermissions, "submissions");
  const editSuggestionsStorageKey = session?.userId
    ? `edit-suggestions:${campaignId}:${session.userId}`
    : `edit-suggestions:${campaignId}`;

  const canManageDirectivesForUser = Boolean(session && canManageDirectives(session));
  const showUserFilter = canOverseeAllContent;
  const inboxDirectives =
    session?.userId && isPostgresConfigured()
      ? withFileAccessTokensDeep(
          await pgListDirectivesForUserInbox(campaignId, session.userId)
        )
      : [];

  const myScoreEntry = session?.userId
      ? (() => {
          const source = buildLeaderboardSourceFromAdmin({
            billboards,
            posters: data.posters ?? [],
            posterVersions: data.posterVersions ?? [],
            videos: data.videos ?? [],
            videoVersions: data.videoVersions ?? [],
            socialPosts: data.socialPosts ?? [],
            activities: data.activities ?? [],
            files: data.files ?? [],
          });
          return (
            buildUserLeaderboard(source).find((entry) => entry.userKey === session.userId) ?? null
          );
        })()
      : null;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">داشبورد</h1>
          <p className="text-muted-foreground text-sm">
            {canOverseeAllContent
              ? data.settings.title
              : `${data.settings.title} — آمار آپلودهای شما`}
          </p>
        </div>
        {canManageAll && (
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/admin/campaigns">
              <Button variant="outline" size="sm" className="gap-1.5">
                <FolderKanban className="h-3.5 w-3.5" />
                مدیریت کمپین‌ها
              </Button>
            </Link>
            <Link href={adminHref("/admin/settings", campaignId)}>
              <Badge variant="outline" className="gap-1 cursor-pointer">
                <Settings className="h-3 w-3" />
                تنظیمات
              </Badge>
            </Link>
          </div>
        )}
      </div>

      {myScoreEntry && <MyScoreSummary entry={myScoreEntry} />}

      <DashboardDirectivesPanel
        campaignId={campaignId}
        canManage={canManageDirectivesForUser}
        inboxDirectives={inboxDirectives}
      />

      <CampaignTools isFullAdmin={canManageAll} />

      <EditSuggestionsPanel
        suggestions={editSuggestions}
        storageKey={editSuggestionsStorageKey}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{data.settings.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{data.settings.description}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge status={data.settings.status}>
              {data.settings.status === "live" ? "زنده" : "پایان‌یافته"}
            </Badge>
            {(canManageAll || Boolean(session && isClientUser(session))) && (
              <Link href={`/campaign/${data.settings.slug}`} target="_blank">
                <Badge variant="outline" className="cursor-pointer">
                  مشاهده صفحه عمومی
                </Badge>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      {visibleStatHrefs.length > 0 ? (
        <AdminDashboardFilteredStats
          campaignId={campaignId}
          contentPlans={data.settings.contentPlans ?? []}
          users={showUserFilter ? users : []}
          showUserFilter={showUserFilter}
          showOwnerHint={!canOverseeAllContent}
          completenessOwnerUserId={
            canOverseeAllContent ? undefined : session?.userId ?? undefined
          }
          billboards={billboards}
          posters={data.posters}
          posterVersions={data.posterVersions}
          videos={data.videos}
          videoVersions={data.videoVersions}
          files={data.files ?? []}
          rawMedia={data.rawMedia ?? []}
          submissions={data.submissions}
          analytics={data.analytics}
          socialPosts={data.socialPosts ?? []}
          socialPlatformStats={data.socialPlatformStats ?? []}
          broadcastReports={data.broadcastReports ?? []}
          meetings={data.meetings ?? []}
          activities={data.activities ?? []}
          smsReports={data.smsReports ?? []}
          visibleHrefs={visibleStatHrefs}
          showBillboardCategoryChart={showBillboardCategoryChart}
          showSubmissionsAlert={showSubmissionsAlert}
        />
      ) : (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            {canOverseeAllContent
              ? "هیچ بخشی برای این کمپین فعال نیست. از تنظیمات کمپین بخش‌های مورد نظر را فعال کنید."
              : "هیچ بخشی برای شما در این کمپین فعال نیست. با مدیر تماس بگیرید."}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
