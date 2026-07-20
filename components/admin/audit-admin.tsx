"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Check,
  FileStack,
  LogIn,
  MousePointerClick,
  Navigation,
  Radio,
  ShieldAlert,
  TriangleAlert,
  Users,
  X,
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
import type {
  AuditActorSummary,
  AuditCategory,
  AuditDashboardData,
  AuditEvent,
  AuditUserPresence,
  UserContentContribution,
} from "@/lib/audit/types";

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
      <div className="min-w-0 text-right">
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

function UserPresenceCard({ user }: { user: AuditUserPresence }) {
  const { displayName, showEmail, email } = resolveUserDisplay(user.name, user.email);

  return (
    <div
      className={`rounded-lg border px-3 py-3 flex items-start gap-3 ${
        user.loggedInToday
          ? "bg-card border-border"
          : "bg-muted/30 border-dashed border-muted-foreground/25"
      }`}
    >
      {user.isOnline ? (
        <span className="relative mt-1.5 flex h-2.5 w-2.5 shrink-0" title="آنلاین">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </span>
      ) : (
        <span
          className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-muted-foreground/30"
          title="آفلاین"
        />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium truncate" title={displayName}>
            {displayName}
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            {user.loggedInToday ? (
              <span
                className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600"
                title="امروز وارد شده"
              >
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
            ) : (
              <span
                className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground"
                title="امروز وارد نشده"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.5} />
              </span>
            )}
            <Badge variant="outline">{getAuditRoleLabel(user.role)}</Badge>
          </div>
        </div>

        {showEmail && email && (
          <p className="text-xs text-muted-foreground truncate mt-0.5" dir="ltr" title={email}>
            {email}
          </p>
        )}

        <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
          <p>
            {user.isOnline ? (
              <span className="font-medium text-emerald-600">آنلاین</span>
            ) : (
              <span>آفلاین</span>
            )}
            {user.lastSeenAt && (
              <> · آخرین فعالیت: {formatPersianDateTime(user.lastSeenAt)}</>
            )}
          </p>
          {user.loggedInToday ? (
            <p>
              ورود امروز
              {user.lastLoginAt ? `: ${formatPersianDateTime(user.lastLoginAt)}` : ""}
              {user.loginCountToday > 1
                ? ` · ${formatPersianNumber(user.loginCountToday)} بار`
                : ""}
            </p>
          ) : (
            <p className="font-medium text-muted-foreground/80">امروز وارد نشده</p>
          )}
          {user.path && (
            <p className="truncate" dir="ltr" title={user.path}>
              {user.path}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

type AuditColumnDef<T> = {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  className?: string;
};

function AuditDataTable<T>({
  columns,
  rows,
  getRowKey,
  emptyMessage = "موردی ثبت نشده است.",
  minWidth = "720px",
}: {
  columns: AuditColumnDef<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  emptyMessage?: string;
  minWidth?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm" style={{ minWidth, direction: "rtl" }}>
        <thead>
          <tr className="bg-muted/50 text-muted-foreground">
            {columns.map((column) => (
              <th
                key={column.key}
                className="border-b px-3 py-3 text-right font-medium whitespace-nowrap"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-3 py-8 text-center text-muted-foreground"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={getRowKey(row)} className="border-b last:border-0">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-3 py-3 text-right align-middle whitespace-nowrap ${column.className ?? ""}`}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
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

const USERS_COLUMNS: AuditColumnDef<AuditActorSummary>[] = [
  {
    key: "user",
    label: "کاربر",
    render: (actor) => (
      <UserCell name={actor.actorName} email={actor.actorEmail} online={actor.isOnline} />
    ),
  },
  {
    key: "role",
    label: "نقش",
    render: (actor) => <Badge variant="outline">{getAuditRoleLabel(actor.actorRole)}</Badge>,
  },
  {
    key: "events",
    label: "کل رویداد",
    className: "font-semibold",
    render: (actor) => formatPersianNumber(actor.eventCount),
  },
  {
    key: "login",
    label: "ورود",
    render: (actor) => formatPersianNumber(actor.loginCount),
  },
  {
    key: "create",
    label: "ثبت",
    render: (actor) => formatPersianNumber(actor.contentCreateCount),
  },
  {
    key: "update",
    label: "ویرایش",
    render: (actor) => formatPersianNumber(actor.contentUpdateCount),
  },
  {
    key: "delete",
    label: "حذف",
    render: (actor) => formatPersianNumber(actor.contentDeleteCount),
  },
  {
    key: "views",
    label: "بازدید",
    render: (actor) => formatPersianNumber(actor.pageViewCount),
  },
  {
    key: "clicks",
    label: "کلیک",
    render: (actor) => formatPersianNumber(actor.clickCount),
  },
  {
    key: "last",
    label: "آخرین فعالیت",
    className: "text-xs text-muted-foreground",
    render: (actor) => (actor.lastSeenAt ? formatPersianDateTime(actor.lastSeenAt) : "—"),
  },
];

const CONTENT_COLUMNS: AuditColumnDef<UserContentContribution>[] = [
  {
    key: "user",
    label: "کاربر",
    render: (row) => <UserCell name={row.name} email={row.email} />,
  },
  {
    key: "total",
    label: "مجموع",
    className: "font-semibold",
    render: (row) => formatPersianNumber(row.total),
  },
  {
    key: "billboards",
    label: "بیلبورد",
    render: (row) => formatPersianNumber(row.billboards),
  },
  {
    key: "posters",
    label: "پوستر",
    render: (row) => formatPersianNumber(row.posters),
  },
  {
    key: "videos",
    label: "ویدیو",
    render: (row) => formatPersianNumber(row.videos),
  },
  {
    key: "files",
    label: "فایل",
    render: (row) => formatPersianNumber(row.files),
  },
  {
    key: "raw",
    label: "راش",
    render: (row) => formatPersianNumber(row.rawMedia),
  },
  {
    key: "social",
    label: "شبکه اجتماعی",
    render: (row) => formatPersianNumber(row.socialPosts),
  },
  {
    key: "activities",
    label: "اقدام",
    render: (row) => formatPersianNumber(row.activities),
  },
  {
    key: "broadcast",
    label: "پخش",
    render: (row) => formatPersianNumber(row.broadcast),
  },
  {
    key: "meetings",
    label: "جلسه",
    render: (row) => formatPersianNumber(row.meetings),
  },
];

const LOGIN_COLUMNS: AuditColumnDef<AuditEvent>[] = [
  {
    key: "user",
    label: "کاربر",
    render: (event) => <UserCell name={event.actorName} email={event.actorEmail} />,
  },
  {
    key: "role",
    label: "نقش",
    render: (event) => <Badge variant="outline">{getAuditRoleLabel(event.actorRole)}</Badge>,
  },
  {
    key: "time",
    label: "زمان ورود",
    className: "text-xs text-muted-foreground",
    render: (event) => formatPersianDateTime(event.createdAt),
  },
  {
    key: "ip",
    label: "IP",
    className: "font-mono text-xs",
    render: (event) => <span dir="ltr">{event.ipAddress ?? "—"}</span>,
  },
];

const EVENT_COLUMNS: AuditColumnDef<AuditEvent>[] = [
  {
    key: "time",
    label: "زمان",
    className: "text-xs text-muted-foreground",
    render: (event) => formatPersianDateTime(event.createdAt),
  },
  {
    key: "user",
    label: "کاربر",
    render: (event) => <UserCell name={event.actorName} email={event.actorEmail} />,
  },
  {
    key: "category",
    label: "دسته",
    render: (event) => (
      <Badge variant={CATEGORY_BADGE_VARIANT[event.category]}>
        {AUDIT_CATEGORY_LABELS[event.category]}
      </Badge>
    ),
  },
  {
    key: "action",
    label: "اقدام",
    render: (event) => getAuditActionLabel(event.action),
  },
  {
    key: "entity",
    label: "مورد",
    render: (event) => getAuditEntityLabel(event.entityType),
  },
  {
    key: "label",
    label: "توضیح",
    className: "!whitespace-normal",
    render: (event) => (
      <span className="line-clamp-2 break-words">{event.label?.trim() || event.path || "—"}</span>
    ),
  },
];

const PATH_COLUMNS: AuditColumnDef<{ path: string; count: number }>[] = [
  {
    key: "path",
    label: "صفحه",
    className: "font-mono text-xs !whitespace-normal",
    render: (row) => <span dir="ltr">{row.path}</span>,
  },
  {
    key: "count",
    label: "تعداد بازدید",
    render: (row) => formatPersianNumber(row.count),
  },
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

  const presenceStats = useMemo(() => {
    const users = data?.allUsersPresence ?? [];
    return {
      total: users.length,
      online: users.filter((user) => user.isOnline).length,
      loggedInToday: users.filter((user) => user.loggedInToday).length,
      absentToday: users.filter((user) => !user.loggedInToday).length,
    };
  }, [data?.allUsersPresence]);

  // Group today's failed logins by the entered identifier + IP so repeated
  // attempts from the same source collapse into a single card with a count.
  const groupedFailedLoginsToday = useMemo(() => {
    const groups = new Map<
      string,
      { event: AuditEvent; attempts: number; enteredEmail: string | null; ip: string | null }
    >();
    for (const event of data?.failedLoginsTodayList ?? []) {
      const enteredEmail =
        (typeof event.metadata?.email === "string" ? event.metadata.email : null) ||
        event.actorEmail;
      const ip =
        (typeof event.metadata?.ip === "string" ? event.metadata.ip : null) || event.ipAddress;
      const key = `${enteredEmail?.trim().toLowerCase() || "empty"}|${ip ?? "unknown"}`;
      const existing = groups.get(key);
      if (existing) {
        existing.attempts += 1;
        if (new Date(event.createdAt) > new Date(existing.event.createdAt)) {
          existing.event = event;
        }
      } else {
        groups.set(key, { event, attempts: 1, enteredEmail, ip });
      }
    }
    return Array.from(groups.values());
  }, [data?.failedLoginsTodayList]);

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
          hint="تلاش تکراری ثبت محتوا یا خطای پیاپی"
        />
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

      <div className="grid grid-cols-1 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex flex-wrap items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              وضعیت همه کاربران
              <Badge variant="outline" className="mr-1">
                {formatPersianNumber(presenceStats.total)}
              </Badge>
              <span className="flex flex-wrap items-center gap-2 text-xs font-normal text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                  </span>
                  آنلاین {formatPersianNumber(presenceStats.online)}
                </span>
                <span className="text-border">|</span>
                <span className="inline-flex items-center gap-1">
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ورود امروز {formatPersianNumber(presenceStats.loggedInToday)}
                </span>
                <span className="text-border">|</span>
                <span className="inline-flex items-center gap-1">
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                  نیامده امروز {formatPersianNumber(presenceStats.absentToday)}
                </span>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {(data.allUsersPresence ?? []).length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                هنوز کاربری در سیستم ثبت نشده است.
              </p>
            ) : (
              <div className="max-h-[520px] overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                  {(data.allUsersPresence ?? []).map((user) => (
                    <UserPresenceCard key={user.userId} user={user} />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              ورودهای ناموفق امروز
              <Badge variant="destructive" className="mr-1">
                {formatPersianNumber(
                  groupedFailedLoginsToday.length > 0
                    ? groupedFailedLoginsToday.length
                    : summary.failedLoginsToday
                )}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {groupedFailedLoginsToday.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                امروز هیچ ورود ناموفقی ثبت نشده است.
              </p>
            ) : (
              <>
                <div className="max-h-[360px] overflow-y-auto">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                    {groupedFailedLoginsToday.map(({ event, attempts, enteredEmail, ip }) => (
                      <div
                        key={event.id}
                        className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-3 flex items-start gap-3"
                      >
                        <ShieldAlert className="mt-1 h-4 w-4 shrink-0 text-destructive" />
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate" dir="ltr" title={enteredEmail ?? ""}>
                            {enteredEmail?.trim() || "بدون نام کاربری"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1.5">
                            آخرین تلاش: {formatPersianDateTime(event.createdAt)}
                          </p>
                          {attempts > 1 && (
                            <p className="text-xs font-medium text-destructive mt-0.5">
                              {formatPersianNumber(attempts)} تلاش ناموفق
                            </p>
                          )}
                          {ip && (
                            <p className="text-xs text-muted-foreground font-mono mt-0.5" dir="ltr">
                              {ip}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="px-4 pb-3 text-xs text-muted-foreground">
                  به‌دلایل امنیتی، رمز عبور واردشده ذخیره و نمایش داده نمی‌شود.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

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
              <AuditDataTable
                columns={PATH_COLUMNS}
                rows={data.topPaths}
                getRowKey={(row) => row.path}
                minWidth="480px"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">فعال‌ترین کاربران</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <AuditDataTable
                columns={USERS_COLUMNS}
                rows={data.topActors}
                getRowKey={(actor) => actor.actorKey}
                minWidth="960px"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">محتوای ثبت‌شده به تفکیک کاربر</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <AuditDataTable
                columns={CONTENT_COLUMNS}
                rows={data.contentByUser}
                getRowKey={(row) => row.userId}
                minWidth="1000px"
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logins">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                ورودهای امروز
                <Badge variant="outline">
                  {formatPersianNumber(data.loginsTodayList.length)}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <AuditDataTable
                columns={LOGIN_COLUMNS}
                rows={data.loginsTodayList}
                getRowKey={(event) => event.id}
                emptyMessage="امروز هنوز ورودی ثبت نشده است."
                minWidth="640px"
              />
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">تاریخچه ورود کاربران</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <AuditDataTable
                columns={LOGIN_COLUMNS}
                rows={data.logins}
                getRowKey={(event) => event.id}
                minWidth="640px"
              />
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
              <AuditDataTable
                columns={EVENT_COLUMNS}
                rows={filteredEvents}
                getRowKey={(event) => event.id}
                emptyMessage="موردی یافت نشد."
                minWidth="900px"
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
