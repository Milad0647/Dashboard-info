import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderKanban, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardCompletenessCards } from "@/components/admin/dashboard-completeness-cards";
import { EditSuggestionsPanel } from "@/components/admin/edit-suggestions-panel";
import { getAdminData, getAllUsers } from "@/lib/data-access/admin";
import { resolveAdminCampaignId } from "@/lib/admin-campaign";
import { DASHBOARD_STAT_DEFINITIONS } from "@/lib/admin-dashboard-stats";
import { resolveAdminBillboards } from "@/lib/billboards";
import type { Billboard, CampaignSettings } from "@/lib/types";
import { CampaignTools } from "@/components/admin/campaign-tools";
import { getAuthSession, getOwnerFilter, isFullAdmin } from "@/lib/auth/get-session";
import {
  defaultContributorPermissions,
  hasContributorPermission,
  type ContributorPermissionKey,
  type ContributorPermissions,
} from "@/lib/contributor-permissions";
import { pgGetUserPermissionsForCampaign } from "@/lib/db/repository-extended";
import {
  buildCategoryCompleteness,
  buildEditSuggestions,
  type CategoryCompletenessSummary,
  type EditSuggestionContentType,
} from "@/lib/edit-suggestions";
import { formatPersianNumber, adminHref, isPostgresConfigured, isSupabaseConfigured } from "@/lib/utils";

function getDatabaseLabel() {
  if (isPostgresConfigured()) return "PostgreSQL";
  if (isSupabaseConfigured()) return "Supabase";
  return "Local";
}

const PERMISSION_TO_CONTENT_TYPE: Partial<
  Record<ContributorPermissionKey, EditSuggestionContentType>
> = {
  billboards: "billboard",
  posters: "poster",
  videos: "video",
  files: "file",
  rawMedia: "rawMedia",
  sitePublications: "sitePublication",
  socialPosts: "socialPost",
  broadcast: "broadcast",
  meetings: "meeting",
  activities: "activity",
};

interface AdminDashboardProps {
  searchParams: Promise<{ campaign?: string }>;
}

export default async function AdminDashboardPage({ searchParams }: AdminDashboardProps) {
  const params = await searchParams;
  const { campaignId } = await resolveAdminCampaignId(params.campaign);

  if (!campaignId) redirect("/admin/campaigns");

  const data = await getAdminData(campaignId);
  if (!data.settings) redirect("/admin/campaigns");
  const session = await getAuthSession();
  const canManageAll = Boolean(session && isFullAdmin(session));
  const ownerUserId = session ? getOwnerFilter(session) : undefined;

  const features = data.settings.features;
  let contributorPermissions: ContributorPermissions | null = null;
  if (!canManageAll && session?.userId) {
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

  const completenessByType = new Map<EditSuggestionContentType, CategoryCompletenessSummary>();
  const completenessInput = {
    campaignId,
    ownerUserId: canManageAll ? undefined : session?.userId,
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
  for (const summary of buildCategoryCompleteness(completenessInput)) {
    completenessByType.set(summary.contentType, summary);
  }

  const editSuggestions = session?.userId
    ? buildEditSuggestions({
        ...completenessInput,
        ownerUserId: session.userId,
      })
    : [];

  const stats = DASHBOARD_STAT_DEFINITIONS.filter((definition) =>
    canManageAll
      ? features[definition.featureKey]
      : hasContributorPermission(contributorPermissions, definition.permissionKey)
  ).map((definition) => {
    const contentType = PERMISSION_TO_CONTENT_TYPE[definition.permissionKey];
    return {
      label: definition.label,
      value: definition.getCount(data, billboards),
      href: adminHref(definition.href, campaignId),
      icon: definition.icon,
      completeness: contentType ? completenessByType.get(contentType) : undefined,
      showOwnerHint: !canManageAll,
    };
  });

  const pendingSubmissions = data.submissions.filter((s) => s.status === "pending").length;
  const showSubmissionsAlert = canManageAll
    ? features.submissions
    : hasContributorPermission(contributorPermissions, "submissions");
  const editSuggestionsStorageKey = session?.userId
    ? `edit-suggestions:${campaignId}:${session.userId}`
    : `edit-suggestions:${campaignId}`;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">داشبورد</h1>
          <p className="text-muted-foreground text-sm">
            {canManageAll ? data.settings.title : `${data.settings.title} — آمار آپلودهای شما`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/admin/campaigns">
            <Button variant="outline" size="sm" className="gap-1.5">
              <FolderKanban className="h-3.5 w-3.5" />
              مدیریت کمپین‌ها
            </Button>
          </Link>
          <Badge variant="success">{getDatabaseLabel()}</Badge>
          {canManageAll && (
            <Link href={adminHref("/admin/settings", campaignId)}>
              <Badge variant="outline" className="gap-1 cursor-pointer">
                <Settings className="h-3 w-3" />
                تنظیمات
              </Badge>
            </Link>
          )}
        </div>
      </div>

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
            <Link href={`/campaign/${data.settings.slug}`} target="_blank">
              <Badge variant="outline" className="cursor-pointer">
                مشاهده صفحه عمومی
              </Badge>
            </Link>
          </div>
        </CardContent>
      </Card>

      {stats.length > 0 ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-emerald-700">کامل = سبز</span>
            <span className="rounded-full bg-amber-400/20 px-2 py-1 text-amber-800">ناقص جزئی = زرد</span>
            <span className="rounded-full bg-red-500/15 px-2 py-1 text-red-700">ناقص کامل = قرمز</span>
          </div>
          <DashboardCompletenessCards cards={stats} />
        </div>
      ) : (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            {canManageAll
              ? "هیچ بخشی برای این کمپین فعال نیست. از تنظیمات کمپین بخش‌های مورد نظر را فعال کنید."
              : "هیچ بخشی برای شما در این کمپین فعال نیست. با مدیر تماس بگیرید."}
          </CardContent>
        </Card>
      )}

      {showSubmissionsAlert && pendingSubmissions > 0 && (
        <Card className="border-warning/30 bg-warning/10">
          <CardContent className="p-4 flex items-center justify-between">
            <p className="text-sm">
              {formatPersianNumber(pendingSubmissions)} ارسال در انتظار بررسی
            </p>
            <Link href={adminHref("/admin/submissions", campaignId)}>
              <Badge variant="warning" className="cursor-pointer">
                مشاهده
              </Badge>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
