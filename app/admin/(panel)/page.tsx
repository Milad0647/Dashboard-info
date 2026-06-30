import Link from "next/link";
import { redirect } from "next/navigation";
import {
  BarChart3,
  FileStack,
  FileText,
  FolderKanban,
  ImageIcon,
  LayoutGrid,
  Settings,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAdminData, getAllUsers } from "@/lib/data-access/admin";
import { resolveAdminCampaignId } from "@/lib/admin-campaign";
import { resolveAdminBillboards } from "@/lib/billboards";
import type { Billboard, CampaignSettings } from "@/lib/types";
import { CampaignTools } from "@/components/admin/campaign-tools";
import { getAuthSession, isFullAdmin } from "@/lib/auth/get-session";
import { formatPersianNumber, adminHref, isPostgresConfigured, isSupabaseConfigured } from "@/lib/utils";

function getDatabaseLabel() {
  if (isPostgresConfigured()) return "PostgreSQL";
  if (isSupabaseConfigured()) return "Supabase";
  return "Local";
}

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
  const canManageAll = session ? isFullAdmin(session) : true;

  const features = data.settings.features;
  const users = await getAllUsers();
  const billboards = data.settings
    ? await resolveAdminBillboards(
        data.settings as CampaignSettings,
        (data.billboards ?? []) as Billboard[],
        users
      )
    : [];

  const stats = [
    { label: "بیلبوردها", value: billboards.length, href: adminHref("/admin/billboards", campaignId), icon: LayoutGrid, show: features.billboards },
    { label: "پوسترها", value: data.posters.length, href: adminHref("/admin/posters", campaignId), icon: ImageIcon, show: features.posters },
    { label: "ویدیوها", value: data.videos.length, href: adminHref("/admin/videos", campaignId), icon: Video, show: features.videos },
    { label: "فایل‌ها", value: (data.files ?? []).length, href: adminHref("/admin/files", campaignId), icon: FileStack, show: features.files },
    { label: "ارسال‌ها", value: data.submissions.length, href: adminHref("/admin/submissions", campaignId), icon: FileText, show: features.submissions },
    { label: "رکورد آمار", value: data.analytics.length, href: adminHref("/admin/analytics", campaignId), icon: BarChart3, show: features.analytics },
  ].filter((s) => s.show);

  const pendingSubmissions = data.submissions.filter((s) => s.status === "pending").length;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">داشبورد</h1>
          <p className="text-muted-foreground text-sm">{data.settings.title}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/admin/campaigns">
            <Button variant="outline" size="sm" className="gap-1.5">
              <FolderKanban className="h-3.5 w-3.5" />
              مدیریت کمپین‌ها
            </Button>
          </Link>
          <Badge variant="success">
            {getDatabaseLabel()}
          </Badge>
          <Link href={adminHref("/admin/settings", campaignId)}>
            <Badge variant="outline" className="gap-1 cursor-pointer">
              <Settings className="h-3 w-3" />
              تنظیمات
            </Badge>
          </Link>
        </div>
      </div>

      <CampaignTools isFullAdmin={canManageAll} />

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
              <Badge variant="outline" className="cursor-pointer">مشاهده صفحه عمومی</Badge>
            </Link>
          </div>
        </CardContent>
      </Card>

      {stats.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Link key={stat.href} href={stat.href}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">{stat.label}</p>
                        <p className="text-2xl font-bold">{formatPersianNumber(stat.value)}</p>
                      </div>
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            هیچ بخشی برای این کمپین فعال نیست. از تنظیمات کمپین بخش‌های مورد نظر را فعال کنید.
          </CardContent>
        </Card>
      )}

      {features.submissions && pendingSubmissions > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-center justify-between">
            <p className="text-sm">
              {formatPersianNumber(pendingSubmissions)} ارسال در انتظار بررسی
            </p>
            <Link href={adminHref("/admin/submissions", campaignId)}>
              <Badge variant="warning" className="cursor-pointer">مشاهده</Badge>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
