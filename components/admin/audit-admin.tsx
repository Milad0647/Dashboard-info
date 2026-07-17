"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  FileStack,
  LogIn,
  MousePointerClick,
  Navigation,
  Radio,
  ShieldAlert,
  TriangleAlert,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AuditProblemsPanel } from "@/components/admin/audit-problems-panel";
import { useChartTheme } from "@/lib/hooks/use-chart-theme";
import {
  formatPersianDateShort,
  formatPersianDateTime,
  formatPersianNumber,
} from "@/lib/utils";
import {
  AUDIT_CATEGORY_LABELS,
  getAuditActionLabel,
  getAuditEntityLabel,
  getAuditRoleLabel,
} from "@/lib/audit/labels";
import type { AuditCategory, AuditDashboardData } from "@/lib/audit/types";

const CATEGORY_BADGE_VARIANT: Record<
  AuditCategory,
  "default" | "outline" | "success" | "warning" | "destructive"
> = {
  auth: "success",
  navigation: "outline",
  content: "default",
  ui: "outline",
  admin: "warning",
  system: "outline",
};

const CLICK_CHART_COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#f97316",
  "#22c55e",
  "#06b6d4",
  "#eab308",
  "#ef4444",
];

interface AuditAdminProps {
  data: AuditDashboardData | null;
  databaseReady: boolean;
}

function resolveUserDisplay(name?: string | null, email?: string | null) {
  const displayName = name?.trim() || email?.trim() || "ناشناس";
  const showEmail = Boolean(email?.trim() && email.trim() !== displayName);
  return { displayName, showEmail, email: email?.trim() || null };
}

function UserCell({
  name,
  email,
  online,
}: {
  name?: string | null;
  email?: string | null;
  online?: boolean;
}) {
  const { displayName, showEmail, email: resolvedEmail } = resolveUserDisplay(name, email);

  return (
    <div className="flex items-start gap-2 min-w-0">
      {online !== undefined && (
        <span
          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
            online ? "bg-emerald-500" : "bg-muted-foreground/30"
          }`}
          title={online ? "آنلاین" : "آفلاین"}
        />
      )}
      <div className="min-w-0">
        <div className="font-medium truncate" title={displayName}>
          {displayName}
        </div>
        {showEmail && resolvedEmail && (
          <div className="text-xs text-muted-foreground truncate" dir="ltr" title={resolvedEmail}>
            {resolvedEmail}
          </div>
        )}
      </div>
    </div>
  );
}

function AuditTable({
  columns,
  children,
  emptyColSpan,
  emptyMessage = "موردی ثبت نشده است.",
  isEmpty,
  minWidth = "720px",
}: {
  columns: { key: string; label: string; width?: string }[];
  children: ReactNode;
  emptyColSpan: number;
  emptyMessage?: string;
  isEmpty: boolean;
  minWidth?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse" style={{ minWidth }}>
        <colgroup>
          {columns.map((column) => (
            <col key={column.key} style={column.width ? { width: column.width } : undefined} />
          ))}
        </colgroup>
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className="text-right font-medium px-3 py-3 whitespace-nowrap border-b"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isEmpty ? (
            <tr>
              <td
                colSpan={emptyColSpan}
                className="px-3 py-8 text-center text-muted-foreground"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: number;
  icon: typeof Activity;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{formatPersianNumber(value)}</p>
            {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
          </div>
          <Icon className="h-5 w-5 text-primary shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}

const USERS_COLUMNS = [
  { key: "user", label: "کاربر", width: "22%" },
  { key: "role", label: "نقش", width: "10%" },
  { key: "events", label: "کل رویداد", width: "9%" },
  { key: "login", label: "ورود", width: "7%" },
  { key: "create", label: "ثبت", width: "7%" },
  { key: "update", label: "ویرایش", width: "8%" },
  { key: "delete", label: "حذف", width: "7%" },
  { key: "views", label: "بازدید", width: "8%" },
  { key: "clicks", label: "کلیک", width: "7%" },
  { key: "last", label: "آخرین فعالیت", width: "15%" },
];

const CONTENT_COLUMNS = [
  { key: "user", label: "کاربر", width: "18%" },
  { key: "total", label: "مجموع", width: "8%" },
  { key: "billboards", label: "بیلبورد", width: "8%" },
  { key: "posters", label: "پوستر", width: "8%" },
  { key: "videos", label: "ویدیو", width: "8%" },
  { key: "files", label: "فایل", width: "7%" },
  { key: "raw", label: "راش", width: "7%" },
  { key: "social", label: "شبکه اجتماعی", width: "10%" },
  { key: "activities", label: "اقدام", width: "8%" },
  { key: "broadcast", label: "پخش", width: "8%" },
  { key: "meetings", label: "جلسه", width: "10%" },
];

const LOGIN_COLUMNS = [
  { key: "user", label: "کاربر", width: "35%" },
  { key: "role", label: "نقش", width: "15%" },
  { key: "time", label: "زمان ورود", width: "30%" },
  { key: "ip", label: "IP", width: "20%" },
];

const EVENT_COLUMNS = [
  { key: "time", label: "زمان", width: "16%" },
  { key: "user", label: "کاربر", width: "20%" },
  { key: "category", label: "دسته", width: "12%" },
  { key: "action", label: "اقدام", width: "14%" },
  { key: "entity", label: "مورد", width: "12%" },
  { key: "label", label: "توضیح", width: "26%" },
];

const PATH_COLUMNS = [
  { key: "path", label: "صفحه", width: "80%" },
  { key: "count", label: "تعداد بازدید", width: "20%" },
];

export function AuditAdmin({ data, databaseReady }: AuditAdminProps) {
  const chartTheme = useChartTheme();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<AuditCategory | "all">("all");

  const dailyChartData = useMemo(
    () =>
      (data?.dailySeries ?? []).map((point) => ({
        ...point,
        label: formatPersianDateShort(point.date),
      })),
    [data?.dailySeries]
  );

  const actionChartData = useMemo(
    () =>
      (data?.topActions ?? [])
        .filter((item) => item.action !== "presence.heartbeat")
        .map((item) => ({
          label: getAuditActionLabel(item.action),
          count: item.count,
        })),
    [data?.topActions]
  );

  const clickChartData = useMemo(
    () =>
      (data?.topClicks ?? []).slice(0, 8).map((item) => ({
        label: item.label.length > 22 ? `${item.label.slice(0, 22)}…` : item.label,
        count: item.count,
      })),
    [data?.topClicks]
  );

  const filteredEvents = useMemo(() => {
    const events = data?.recentEvents ?? [];
    const term = search.trim().toLowerCase();
    return events.filter((event) => {
      if (categoryFilter !== "all" && event.category !== categoryFilter) return false;
      if (!term) return true;
      const { displayName } = resolveUserDisplay(event.actorName, event.actorEmail);
      return [
        displayName,
        event.actorEmail,
        getAuditActionLabel(event.action),
        event.label,
        event.path,
        getAuditEntityLabel(event.entityType),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [data?.recentEvents, search, categoryFilter]);

  if (!databaseReady || !data) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title="رصد فعالیت کاربران"
          description="گزارش کامل ورود، فعالیت و محتوای ثبت‌شده توسط کاربران"
        />
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            رصد فعالیت فقط روی پایگاه‌داده PostgreSQL فعال است. لطفاً اتصال دیتابیس را
            پیکربندی و مهاجرت (`npm run db:migrate`) را اجرا کنید.
          </CardContent>
        </Card>
      </div>
    );
  }

  const { summary } = data;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="رصد فعالیت کاربران"
        description="چه کسی وارد شده، چه محتوایی ثبت کرده، کجا رفته و روی چه دکمه‌هایی کلیک کرده است"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="کاربران آنلاین"
          value={summary.onlineUsers}
          icon={Radio}
          hint="فعال در ۵ دقیقه اخیر"
        />
        <StatCard
          label="گزارش مشکل باز"
          value={summary.openProblemReports}
          icon={AlertTriangle}
          hint="در انتظار یا در حال بررسی"
        />
        <StatCard
          label="هشدار رفتار"
          value={summary.stuckSignals}
          icon={TriangleAlert}
          hint="احتمال گیر کردن کاربر"
        />
        <StatCard label="کاربران فعال امروز" value={summary.activeUsersToday} icon={Users} />
        <StatCard label="ورود امروز" value={summary.loginsToday} icon={LogIn} />
        <StatCard label="تغییرات محتوا امروز" value={summary.contentChangesToday} icon={FileStack} />
        <StatCard label="بازدید صفحه امروز" value={summary.pageViewsToday} icon={Navigation} />
        <StatCard label="کلیک امروز" value={summary.clicksToday} icon={MousePointerClick} />
        <StatCard label="کل رویدادها" value={summary.totalEvents} icon={Activity} />
        <StatCard
          label="ورود ناموفق امروز"
          value={summary.failedLoginsToday}
          icon={ShieldAlert}
          hint={summary.failedLoginsToday > 0 ? "بررسی امنیتی توصیه می‌شود" : undefined}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            کاربران آنلاین الان
            <Badge variant="success" className="mr-1">
              {formatPersianNumber(data.onlineUsers.length)}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.onlineUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              در ۵ دقیقه اخیر هیچ کاربری آنلاین نبوده است.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {data.onlineUsers.map((user) => (
                <div
                  key={user.actorKey}
                  className="rounded-lg border bg-card px-3 py-3 flex items-start gap-3"
                >
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium truncate">
                        {resolveUserDisplay(user.actorName, user.actorEmail).displayName}
                      </p>
                      <Badge variant="outline" className="shrink-0">
                        {getAuditRoleLabel(user.actorRole)}
                      </Badge>
                    </div>
                    {user.actorEmail && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5" dir="ltr">
                        {user.actorEmail}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1.5">
                      آخرین فعالیت: {formatPersianDateTime(user.lastSeenAt)}
                    </p>
                    {user.path && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5" dir="ltr">
                        {user.path}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">نمای کلی</TabsTrigger>
          <TabsTrigger value="problems">
            مشکلات
            {(summary.openProblemReports > 0 || summary.stuckSignals > 0) && (
              <Badge variant="warning" className="mr-1.5">
                {formatPersianNumber(summary.openProblemReports + summary.stuckSignals)}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="users">کاربران</TabsTrigger>
          <TabsTrigger value="content">محتوای هر کاربر</TabsTrigger>
          <TabsTrigger value="logins">ورودها</TabsTrigger>
          <TabsTrigger value="events">رویدادها</TabsTrigger>
        </TabsList>

        <TabsContent value="problems">
          <AuditProblemsPanel
            reports={data.problemReports ?? []}
            signals={data.stuckSignals ?? []}
          />
        </TabsContent>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">روند فعالیت ۱۴ روز اخیر</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyChartData}>
                    <defs>
                      <linearGradient id="auditTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="auditContent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: chartTheme.tick }} />
                    <YAxis
                      tick={{ fontSize: 11, fill: chartTheme.tick }}
                      allowDecimals={false}
                      tickFormatter={(v) => formatPersianNumber(v)}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        formatPersianNumber(value),
                        name,
                      ]}
                      labelFormatter={(label) => `تاریخ: ${label}`}
                      contentStyle={chartTheme.tooltipContentStyle}
                      labelStyle={chartTheme.tooltipLabelStyle}
                    />
                    <Legend wrapperStyle={chartTheme.legendStyle} />
                    <Area
                      type="monotone"
                      dataKey="total"
                      name="کل رویدادها"
                      stroke="#3b82f6"
                      fill="url(#auditTotal)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="content"
                      name="تغییرات محتوا"
                      stroke="#22c55e"
                      fill="url(#auditContent)"
                      strokeWidth={2}
                    />
                    <Area
                      type="monotone"
                      dataKey="logins"
                      name="ورودها"
                      stroke="#f97316"
                      fillOpacity={0}
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">پرتکرارترین اقدام‌ها</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full" dir="ltr">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={actionChartData} layout="vertical" margin={{ right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} horizontal={false} />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 11, fill: chartTheme.tick }}
                        allowDecimals={false}
                        tickFormatter={(v) => formatPersianNumber(v)}
                      />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={110}
                        tick={{ fontSize: 11, fill: chartTheme.tick }}
                      />
                      <Tooltip
                        formatter={(value: number) => formatPersianNumber(value)}
                        contentStyle={chartTheme.tooltipContentStyle}
                        labelStyle={chartTheme.tooltipLabelStyle}
                      />
                      <Bar dataKey="count" name="تعداد" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">پرکلیک‌ترین دکمه‌ها</CardTitle>
              </CardHeader>
              <CardContent>
                {clickChartData.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-12 text-center">
                    هنوز کلیکی ثبت نشده است.
                  </p>
                ) : (
                  <div className="h-[300px] w-full" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={clickChartData} layout="vertical" margin={{ right: 16 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} horizontal={false} />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 11, fill: chartTheme.tick }}
                          allowDecimals={false}
                          tickFormatter={(v) => formatPersianNumber(v)}
                        />
                        <YAxis
                          type="category"
                          dataKey="label"
                          width={130}
                          tick={{ fontSize: 11, fill: chartTheme.tick }}
                        />
                        <Tooltip
                          formatter={(value: number) => formatPersianNumber(value)}
                          contentStyle={chartTheme.tooltipContentStyle}
                          labelStyle={chartTheme.tooltipLabelStyle}
                        />
                        <Bar dataKey="count" name="کلیک" radius={[0, 4, 4, 0]}>
                          {clickChartData.map((_, index) => (
                            <Cell
                              key={index}
                              fill={CLICK_CHART_COLORS[index % CLICK_CHART_COLORS.length]}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">پربازدیدترین صفحات</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <AuditTable
                columns={PATH_COLUMNS}
                emptyColSpan={2}
                isEmpty={data.topPaths.length === 0}
                minWidth="480px"
              >
                {data.topPaths.map((row) => (
                  <tr key={row.path} className="border-b last:border-0">
                    <td className="px-3 py-2.5 font-mono text-xs" dir="ltr">
                      {row.path}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {formatPersianNumber(row.count)}
                    </td>
                  </tr>
                ))}
              </AuditTable>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">فعال‌ترین کاربران</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <AuditTable
                columns={USERS_COLUMNS}
                emptyColSpan={10}
                isEmpty={data.topActors.length === 0}
                minWidth="960px"
              >
                {data.topActors.map((actor) => (
                  <tr key={actor.actorKey} className="border-b last:border-0">
                    <td className="px-3 py-3 align-middle">
                      <UserCell
                        name={actor.actorName}
                        email={actor.actorEmail}
                        online={actor.isOnline}
                      />
                    </td>
                    <td className="px-3 py-3 align-middle whitespace-nowrap">
                      <Badge variant="outline">{getAuditRoleLabel(actor.actorRole)}</Badge>
                    </td>
                    <td className="px-3 py-3 align-middle whitespace-nowrap font-semibold">
                      {formatPersianNumber(actor.eventCount)}
                    </td>
                    <td className="px-3 py-3 align-middle whitespace-nowrap">
                      {formatPersianNumber(actor.loginCount)}
                    </td>
                    <td className="px-3 py-3 align-middle whitespace-nowrap">
                      {formatPersianNumber(actor.contentCreateCount)}
                    </td>
                    <td className="px-3 py-3 align-middle whitespace-nowrap">
                      {formatPersianNumber(actor.contentUpdateCount)}
                    </td>
                    <td className="px-3 py-3 align-middle whitespace-nowrap">
                      {formatPersianNumber(actor.contentDeleteCount)}
                    </td>
                    <td className="px-3 py-3 align-middle whitespace-nowrap">
                      {formatPersianNumber(actor.pageViewCount)}
                    </td>
                    <td className="px-3 py-3 align-middle whitespace-nowrap">
                      {formatPersianNumber(actor.clickCount)}
                    </td>
                    <td className="px-3 py-3 align-middle whitespace-nowrap text-xs text-muted-foreground">
                      {actor.lastSeenAt ? formatPersianDateTime(actor.lastSeenAt) : "—"}
                    </td>
                  </tr>
                ))}
              </AuditTable>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">محتوای ثبت‌شده به تفکیک کاربر</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <AuditTable
                columns={CONTENT_COLUMNS}
                emptyColSpan={11}
                isEmpty={data.contentByUser.length === 0}
                minWidth="1000px"
              >
                {data.contentByUser.map((row) => (
                  <tr key={row.userId} className="border-b last:border-0">
                    <td className="px-3 py-3 align-middle">
                      <UserCell name={row.name} email={row.email} />
                    </td>
                    <td className="px-3 py-3 align-middle whitespace-nowrap font-semibold">
                      {formatPersianNumber(row.total)}
                    </td>
                    <td className="px-3 py-3 align-middle whitespace-nowrap">
                      {formatPersianNumber(row.billboards)}
                    </td>
                    <td className="px-3 py-3 align-middle whitespace-nowrap">
                      {formatPersianNumber(row.posters)}
                    </td>
                    <td className="px-3 py-3 align-middle whitespace-nowrap">
                      {formatPersianNumber(row.videos)}
                    </td>
                    <td className="px-3 py-3 align-middle whitespace-nowrap">
                      {formatPersianNumber(row.files)}
                    </td>
                    <td className="px-3 py-3 align-middle whitespace-nowrap">
                      {formatPersianNumber(row.rawMedia)}
                    </td>
                    <td className="px-3 py-3 align-middle whitespace-nowrap">
                      {formatPersianNumber(row.socialPosts)}
                    </td>
                    <td className="px-3 py-3 align-middle whitespace-nowrap">
                      {formatPersianNumber(row.activities)}
                    </td>
                    <td className="px-3 py-3 align-middle whitespace-nowrap">
                      {formatPersianNumber(row.broadcast)}
                    </td>
                    <td className="px-3 py-3 align-middle whitespace-nowrap">
                      {formatPersianNumber(row.meetings)}
                    </td>
                  </tr>
                ))}
              </AuditTable>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logins">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">تاریخچه ورود کاربران</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <AuditTable
                columns={LOGIN_COLUMNS}
                emptyColSpan={4}
                isEmpty={data.logins.length === 0}
                minWidth="640px"
              >
                {data.logins.map((event) => (
                  <tr key={event.id} className="border-b last:border-0">
                    <td className="px-3 py-3 align-middle">
                      <UserCell name={event.actorName} email={event.actorEmail} />
                    </td>
                    <td className="px-3 py-3 align-middle whitespace-nowrap">
                      <Badge variant="outline">{getAuditRoleLabel(event.actorRole)}</Badge>
                    </td>
                    <td className="px-3 py-3 align-middle whitespace-nowrap text-xs text-muted-foreground">
                      {formatPersianDateTime(event.createdAt)}
                    </td>
                    <td className="px-3 py-3 align-middle font-mono text-xs whitespace-nowrap" dir="ltr">
                      {event.ipAddress ?? "—"}
                    </td>
                  </tr>
                ))}
              </AuditTable>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="جستجو در رویدادها…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="sm:max-w-xs"
            />
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                data-audit-label="فیلتر: همه"
                onClick={() => setCategoryFilter("all")}
                className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
                  categoryFilter === "all"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                همه
              </button>
              {(Object.keys(AUDIT_CATEGORY_LABELS) as AuditCategory[]).map((category) => (
                <button
                  key={category}
                  type="button"
                  data-audit-label={`فیلتر: ${AUDIT_CATEGORY_LABELS[category]}`}
                  onClick={() => setCategoryFilter(category)}
                  className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
                    categoryFilter === category
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent"
                  }`}
                >
                  {AUDIT_CATEGORY_LABELS[category]}
                </button>
              ))}
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <AuditTable
                columns={EVENT_COLUMNS}
                emptyColSpan={6}
                emptyMessage="موردی یافت نشد."
                isEmpty={filteredEvents.length === 0}
                minWidth="900px"
              >
                {filteredEvents.map((event) => (
                  <tr key={event.id} className="border-b last:border-0">
                    <td className="px-3 py-3 align-middle whitespace-nowrap text-xs text-muted-foreground">
                      {formatPersianDateTime(event.createdAt)}
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <UserCell name={event.actorName} email={event.actorEmail} />
                    </td>
                    <td className="px-3 py-3 align-middle whitespace-nowrap">
                      <Badge variant={CATEGORY_BADGE_VARIANT[event.category]}>
                        {AUDIT_CATEGORY_LABELS[event.category]}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 align-middle whitespace-nowrap">
                      {getAuditActionLabel(event.action)}
                    </td>
                    <td className="px-3 py-3 align-middle whitespace-nowrap">
                      {getAuditEntityLabel(event.entityType)}
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <span className="line-clamp-2 break-words">
                        {event.label?.trim() || event.path || "—"}
                      </span>
                    </td>
                  </tr>
                ))}
              </AuditTable>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
