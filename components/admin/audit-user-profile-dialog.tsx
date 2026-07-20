"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileStack,
  Loader2,
  LogIn,
  MousePointerClick,
  Navigation,
  Radio,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PersianDateInput } from "@/components/ui/persian-date-input";
import {
  getUserAuditProfileAction,
  type UserAuditProfileResult,
} from "@/lib/actions/audit-actions";
import {
  AUDIT_CATEGORY_LABELS,
  getAuditActionLabel,
  getAuditEntityLabel,
  getAuditRoleLabel,
} from "@/lib/audit/labels";
import type { AuditCategory, AuditEvent } from "@/lib/audit/types";
import { useChartTheme } from "@/lib/hooks/use-chart-theme";
import {
  getTehranCalendarDateIso,
  getTehranDayBoundsIso,
  getTehranOffsetDateIso,
} from "@/lib/safe-dates";
import {
  formatPersianDateShort,
  formatPersianDateTime,
  formatPersianDurationFromSeconds,
  formatPersianNumber,
} from "@/lib/utils";

export type AuditProfileUser = {
  userId: string;
  name?: string | null;
  email?: string | null;
  role?: string | null;
  isOnline?: boolean;
  lastSeenAt?: string | null;
};

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

const ACTION_CHART_COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f97316",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#eab308",
  "#ef4444",
];

const tehranHourMinuteFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Tehran",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function resolveUserDisplay(name?: string | null, email?: string | null) {
  const displayName = name?.trim() || email?.trim() || "ناشناس";
  const showEmail = Boolean(email?.trim() && email.trim() !== displayName);
  return { displayName, showEmail, email: email?.trim() || null };
}

function shiftIsoDate(dateIso: string, deltaDays: number): string {
  const base = new Date(`${dateIso}T12:00:00+03:30`);
  if (Number.isNaN(base.getTime())) return getTehranCalendarDateIso();
  base.setTime(base.getTime() + deltaDays * 24 * 60 * 60 * 1000);
  return getTehranCalendarDateIso(base);
}

function formatTehranClock(iso: string): string {
  const raw = tehranHourMinuteFormatter.format(new Date(iso));
  return raw.replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)] ?? digit);
}

/** Position (0–100) of an instant within a Tehran calendar day. */
function dayPositionPercent(iso: string, dateIso: string): number {
  const bounds = getTehranDayBoundsIso(dateIso);
  if (!bounds) return 0;
  const start = new Date(bounds.from).getTime();
  const end = new Date(bounds.to).getTime();
  const value = new Date(iso).getTime();
  if (!Number.isFinite(value) || end <= start) return 0;
  return Math.min(100, Math.max(0, ((value - start) / (end - start)) * 100));
}

function describeEvent(event: AuditEvent): string {
  const action = getAuditActionLabel(event.action);
  const entity = event.entityType ? getAuditEntityLabel(event.entityType) : null;
  const detail = event.label?.trim() || event.path || null;

  if (event.action === "auth.login") {
    return detail ? `وارد سیستم شد (${detail})` : "وارد سیستم شد";
  }
  if (event.action === "auth.logout") return "از سیستم خارج شد";
  if (event.action === "navigation.page_view") {
    return detail ? `صفحه «${detail}» را باز کرد` : "صفحه‌ای را باز کرد";
  }
  if (event.action === "ui.click") {
    return detail ? `روی «${detail}» کلیک کرد` : "روی یک دکمه کلیک کرد";
  }
  if (event.action === "content.create") {
    return entity ? `${entity} جدید ثبت کرد` : "محتوای جدید ثبت کرد";
  }
  if (event.action === "content.update") {
    return entity ? `${entity} را ویرایش کرد` : "محتوا را ویرایش کرد";
  }
  if (event.action === "content.delete") {
    return entity ? `${entity} را حذف کرد` : "محتوا را حذف کرد";
  }
  if (event.action === "ui.error") {
    return detail ? `با خطا روبه‌رو شد: ${detail}` : "با خطای کاربر روبه‌رو شد";
  }

  if (entity && detail) return `${action} · ${entity} · ${detail}`;
  if (entity) return `${action} · ${entity}`;
  if (detail) return `${action} · ${detail}`;
  return action;
}

export function AuditUserProfileDialog({
  user,
  open,
  onOpenChange,
  initialDate,
}: {
  user: AuditProfileUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate?: string;
}) {
  const chartTheme = useChartTheme();
  const todayIso = getTehranCalendarDateIso();
  const yesterdayIso = getTehranOffsetDateIso(-1);

  const [selectedDate, setSelectedDate] = useState(
    () => initialDate || getTehranCalendarDateIso()
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserAuditProfileResult | null>(null);

  const { displayName, showEmail, email } = resolveUserDisplay(user?.name, user?.email);

  useEffect(() => {
    if (!open) return;
    setSelectedDate(initialDate || getTehranCalendarDateIso());
  }, [open, initialDate, user?.userId]);

  useEffect(() => {
    if (!open || !user?.userId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    void getUserAuditProfileAction(user.userId, selectedDate).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error);
        setProfile(null);
      } else {
        setProfile(result.data);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [open, user?.userId, selectedDate]);

  const dailyChartData = useMemo(
    () =>
      (profile?.dailySeries ?? []).map((point) => ({
        ...point,
        label: formatPersianDateShort(point.date),
      })),
    [profile?.dailySeries]
  );

  const hourlyChartData = useMemo(
    () =>
      (profile?.hourlyActivity ?? []).map((point) => ({
        ...point,
        label: formatPersianNumber(point.hour),
      })),
    [profile?.hourlyActivity]
  );

  const actionChartData = useMemo(
    () =>
      (profile?.topActions ?? []).map((item) => ({
        label: getAuditActionLabel(item.action),
        count: item.count,
      })),
    [profile?.topActions]
  );

  const timelineEvents = useMemo(() => {
    const events = profile?.events ?? [];
    return [...events].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [profile?.events]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] w-[min(96vw,1100px)] max-w-5xl overflow-hidden flex flex-col gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0 space-y-3">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {user?.isOnline !== undefined && (
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                  user.isOnline ? "bg-emerald-500" : "bg-muted-foreground/30"
                }`}
                title={user.isOnline ? "آنلاین" : "آفلاین"}
              />
            )}
            گزارش کامل رصد — {displayName}
          </DialogTitle>
          <DialogDescription className="space-y-0.5">
            {showEmail && email && (
              <span className="block" dir="ltr">
                {email}
              </span>
            )}
            {user?.role && (
              <span className="block">نقش: {getAuditRoleLabel(user.role)}</span>
            )}
            {user?.lastSeenAt && (
              <span className="block">
                آخرین فعالیت: {formatPersianDateTime(user.lastSeenAt)}
              </span>
            )}
          </DialogDescription>

          <div className="flex flex-col sm:flex-row sm:items-end gap-3 pt-1">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                data-audit-label="روز قبل در پروفایل رصد"
                onClick={() => setSelectedDate((date) => shiftIsoDate(date, -1))}
                aria-label="روز قبل"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <div className="w-[200px]">
                <PersianDateInput value={selectedDate} onChange={setSelectedDate} />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                data-audit-label="روز بعد در پروفایل رصد"
                onClick={() => setSelectedDate((date) => shiftIsoDate(date, 1))}
                disabled={selectedDate >= todayIso}
                aria-label="روز بعد"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={selectedDate === todayIso ? "default" : "outline"}
                data-audit-label="امروز در پروفایل رصد"
                onClick={() => setSelectedDate(todayIso)}
              >
                امروز
              </Button>
              <Button
                type="button"
                size="sm"
                variant={selectedDate === yesterdayIso ? "default" : "outline"}
                data-audit-label="دیروز در پروفایل رصد"
                onClick={() => setSelectedDate(yesterdayIso)}
              >
                دیروز
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4 min-h-[280px] max-h-[calc(92vh-180px)]">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              در حال آماده‌سازی گزارش کاربر…
            </div>
          ) : error ? (
            <p className="py-16 text-center text-sm text-destructive">{error}</p>
          ) : !profile ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              داده‌ای برای نمایش نیست.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <MiniStat
                  label="مدت آنلاین"
                  value={formatPersianDurationFromSeconds(profile.summary.onlineSeconds)}
                  icon={Clock}
                  hint={`${formatPersianNumber(profile.summary.sessionCount)} نشست`}
                />
                <MiniStat
                  label="ورود"
                  value={formatPersianNumber(profile.summary.logins)}
                  icon={LogIn}
                />
                <MiniStat
                  label="رویداد"
                  value={formatPersianNumber(profile.summary.totalEvents)}
                  icon={Activity}
                />
                <MiniStat
                  label="محتوا"
                  value={formatPersianNumber(profile.summary.contentChanges)}
                  icon={FileStack}
                  hint={`ثبت ${formatPersianNumber(profile.summary.contentCreates)} · ویرایش ${formatPersianNumber(profile.summary.contentUpdates)}`}
                />
                <MiniStat
                  label="بازدید"
                  value={formatPersianNumber(profile.summary.pageViews)}
                  icon={Navigation}
                />
                <MiniStat
                  label="کلیک"
                  value={formatPersianNumber(profile.summary.clicks)}
                  icon={MousePointerClick}
                />
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex flex-wrap items-center gap-2">
                    <Radio className="h-4 w-4 text-primary" />
                    خط زمانی حضور در {formatPersianDateShort(selectedDate)}
                    <Badge variant="outline">
                      {formatPersianDurationFromSeconds(profile.summary.onlineSeconds)} آنلاین
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <DayPresenceBar
                    dateIso={selectedDate}
                    sessions={profile.sessions}
                    events={timelineEvents}
                  />

                  {profile.sessions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      در این روز حضور آنلاین ثبت‌شده‌ای دیده نشد (ورود یا heartbeat).
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {profile.sessions.map((session, index) => (
                        <li
                          key={`${session.startAt}-${session.endAt}`}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                        >
                          <span className="font-medium">
                            نشست {formatPersianNumber(index + 1)}
                          </span>
                          <span className="text-muted-foreground">
                            {formatTehranClock(session.startAt)} تا{" "}
                            {formatTehranClock(session.endAt)}
                          </span>
                          <Badge variant="outline">
                            {formatPersianDurationFromSeconds(session.durationSeconds)}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">روند ۱۴ روز اخیر این کاربر</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[240px] w-full" dir="ltr">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={dailyChartData}>
                          <defs>
                            <linearGradient id="userAuditTotal" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                          <XAxis dataKey="label" tick={{ fontSize: 10, fill: chartTheme.tick }} />
                          <YAxis
                            tick={{ fontSize: 10, fill: chartTheme.tick }}
                            allowDecimals={false}
                            tickFormatter={(value) => formatPersianNumber(value)}
                          />
                          <Tooltip
                            formatter={(value: number, name: string) => [
                              formatPersianNumber(value),
                              name,
                            ]}
                            contentStyle={chartTheme.tooltipContentStyle}
                            labelStyle={chartTheme.tooltipLabelStyle}
                          />
                          <Legend wrapperStyle={chartTheme.legendStyle} />
                          <Area
                            type="monotone"
                            dataKey="total"
                            name="کل رویداد"
                            stroke="#3b82f6"
                            fill="url(#userAuditTotal)"
                            strokeWidth={2}
                          />
                          <Area
                            type="monotone"
                            dataKey="content"
                            name="محتوا"
                            stroke="#22c55e"
                            fillOpacity={0}
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">توزیع ساعتی فعالیت امروز انتخاب‌شده</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[240px] w-full" dir="ltr">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={hourlyChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                          <XAxis dataKey="label" tick={{ fontSize: 10, fill: chartTheme.tick }} />
                          <YAxis
                            tick={{ fontSize: 10, fill: chartTheme.tick }}
                            allowDecimals={false}
                            tickFormatter={(value) => formatPersianNumber(value)}
                          />
                          <Tooltip
                            formatter={(value: number, name: string) => [
                              formatPersianNumber(value),
                              name,
                            ]}
                            labelFormatter={(label) => `ساعت ${label}`}
                            contentStyle={chartTheme.tooltipContentStyle}
                            labelStyle={chartTheme.tooltipLabelStyle}
                          />
                          <Legend wrapperStyle={chartTheme.legendStyle} />
                          <Bar dataKey="total" name="کل" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                          <Bar dataKey="content" name="محتوا" fill="#22c55e" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">پرتکرارترین اقدام‌ها</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {actionChartData.length === 0 ? (
                      <p className="py-10 text-center text-sm text-muted-foreground">
                        اقدامی در این روز ثبت نشده است.
                      </p>
                    ) : (
                      <div className="h-[240px] w-full" dir="ltr">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={actionChartData} layout="vertical" margin={{ right: 12 }}>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke={chartTheme.grid}
                              horizontal={false}
                            />
                            <XAxis
                              type="number"
                              tick={{ fontSize: 10, fill: chartTheme.tick }}
                              allowDecimals={false}
                              tickFormatter={(value) => formatPersianNumber(value)}
                            />
                            <YAxis
                              type="category"
                              dataKey="label"
                              width={110}
                              tick={{ fontSize: 10, fill: chartTheme.tick }}
                            />
                            <Tooltip
                              formatter={(value: number) => formatPersianNumber(value)}
                              contentStyle={chartTheme.tooltipContentStyle}
                              labelStyle={chartTheme.tooltipLabelStyle}
                            />
                            <Bar dataKey="count" name="تعداد" radius={[0, 4, 4, 0]}>
                              {actionChartData.map((_, index) => (
                                <Cell
                                  key={index}
                                  fill={ACTION_CHART_COLORS[index % ACTION_CHART_COLORS.length]}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">صفحات پربازدید</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {(profile.topPaths ?? []).length === 0 ? (
                      <p className="py-10 text-center text-sm text-muted-foreground">
                        بازدیدی ثبت نشده است.
                      </p>
                    ) : (
                      <ul className="divide-y max-h-[260px] overflow-y-auto">
                        {profile.topPaths.map((row) => (
                          <li
                            key={row.path}
                            className="px-4 py-2.5 flex items-center justify-between gap-3 text-sm"
                          >
                            <span className="font-mono text-xs truncate" dir="ltr" title={row.path}>
                              {row.path}
                            </span>
                            <Badge variant="outline">{formatPersianNumber(row.count)}</Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    شرح کارها در این روز
                    <Badge variant="outline">
                      {formatPersianNumber(timelineEvents.length)} مورد
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {timelineEvents.length === 0 ? (
                    <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                      در این تاریخ فعالیت معناداری برای این کاربر ثبت نشده است.
                    </p>
                  ) : (
                    <ol className="relative border-r border-border/70 mr-4 sm:mr-6">
                      {timelineEvents.map((event) => (
                        <li key={event.id} className="pr-6 sm:pr-8 pb-4 last:pb-2 relative">
                          <span className="absolute top-1.5 -right-[5px] h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background" />
                          <div className="rounded-lg border px-3 py-2.5 space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs text-muted-foreground tabular-nums">
                                {formatTehranClock(event.createdAt)}
                              </span>
                              <Badge variant={CATEGORY_BADGE_VARIANT[event.category]}>
                                {AUDIT_CATEGORY_LABELS[event.category]}
                              </Badge>
                            </div>
                            <p className="text-sm font-medium leading-6">{describeEvent(event)}</p>
                            {(event.label?.trim() || event.path) && (
                              <p
                                className="text-xs text-muted-foreground line-clamp-2 break-words"
                                dir={event.path && !event.label?.trim() ? "ltr" : undefined}
                              >
                                {event.label?.trim() || event.path}
                              </p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MiniStat({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string;
  icon: typeof Activity;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-base font-bold truncate" title={value}>
              {value}
            </p>
            {hint && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{hint}</p>}
          </div>
          <Icon className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        </div>
      </CardContent>
    </Card>
  );
}

function DayPresenceBar({
  dateIso,
  sessions,
  events,
}: {
  dateIso: string;
  sessions: UserAuditProfileResult["sessions"];
  events: AuditEvent[];
}) {
  const markers = useMemo(() => {
    return events
      .filter((event) =>
        ["auth.login", "auth.logout", "content.create", "content.update", "content.delete"].includes(
          event.action
        )
      )
      .slice(0, 40)
      .map((event) => ({
        id: event.id,
        left: dayPositionPercent(event.createdAt, dateIso),
        title: `${formatTehranClock(event.createdAt)} — ${describeEvent(event)}`,
        tone:
          event.action === "auth.login"
            ? "bg-emerald-500"
            : event.action === "auth.logout"
              ? "bg-slate-500"
              : "bg-amber-500",
      }));
  }, [events, dateIso]);

  return (
    <div className="space-y-2" dir="ltr">
      <div className="relative h-10 rounded-lg bg-muted/60 overflow-hidden border">
        {sessions.map((session) => {
          const left = dayPositionPercent(session.startAt, dateIso);
          const right = dayPositionPercent(session.endAt, dateIso);
          const width = Math.max(0.4, right - left);
          return (
            <div
              key={`${session.startAt}-${session.endAt}`}
              className="absolute top-1 bottom-1 rounded-md bg-emerald-500/70"
              style={{ left: `${left}%`, width: `${width}%` }}
              title={`${formatTehranClock(session.startAt)} – ${formatTehranClock(session.endAt)}`}
            />
          );
        })}
        {markers.map((marker) => (
          <div
            key={marker.id}
            className={`absolute top-0 bottom-0 w-0.5 ${marker.tone}`}
            style={{ left: `${marker.left}%` }}
            title={marker.title}
          />
        ))}
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground px-0.5">
        <span>۰۰:۰۰</span>
        <span>۰۶:۰۰</span>
        <span>۱۲:۰۰</span>
        <span>۱۸:۰۰</span>
        <span>۲۴:۰۰</span>
      </div>
      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-sm bg-emerald-500/70" />
          بازه آنلاین
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-0.5 bg-emerald-500" />
          ورود
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-0.5 bg-amber-500" />
          تغییر محتوا
        </span>
      </div>
    </div>
  );
}
