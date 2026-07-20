"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileStack,
  Loader2,
  LogIn,
  MousePointerClick,
  Navigation,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PersianDateInput } from "@/components/ui/persian-date-input";
import { getAuditEventsForDayAction } from "@/lib/actions/audit-actions";
import {
  AUDIT_CATEGORY_LABELS,
  getAuditActionLabel,
  getAuditEntityLabel,
  getAuditRoleLabel,
} from "@/lib/audit/labels";
import type { AuditCategory, AuditEvent } from "@/lib/audit/types";
import {
  getTehranCalendarDateIso,
  getTehranOffsetDateIso,
} from "@/lib/safe-dates";
import {
  formatPersianDateShort,
  formatPersianDateTime,
  formatPersianNumber,
} from "@/lib/utils";

type DayActor = {
  actorKey: string;
  actorUserId: string | null;
  actorName: string;
  actorEmail: string | null;
  actorRole: string | null;
  eventCount: number;
  loginCount: number;
  contentCount: number;
  pageViewCount: number;
  clickCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
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

function aggregateDayActors(events: AuditEvent[]): DayActor[] {
  const map = new Map<string, DayActor>();

  for (const event of events) {
    const actorKey =
      event.actorUserId ||
      event.actorEmail?.trim().toLowerCase() ||
      event.actorName?.trim() ||
      "anonymous";

    const existing = map.get(actorKey);
    if (!existing) {
      map.set(actorKey, {
        actorKey,
        actorUserId: event.actorUserId,
        actorName: event.actorName?.trim() || event.actorEmail?.trim() || "ناشناس",
        actorEmail: event.actorEmail,
        actorRole: event.actorRole,
        eventCount: 1,
        loginCount: event.action === "auth.login" ? 1 : 0,
        contentCount: event.category === "content" ? 1 : 0,
        pageViewCount: event.action === "navigation.page_view" ? 1 : 0,
        clickCount: event.action === "ui.click" ? 1 : 0,
        firstSeenAt: event.createdAt,
        lastSeenAt: event.createdAt,
      });
      continue;
    }

    existing.eventCount += 1;
    if (event.action === "auth.login") existing.loginCount += 1;
    if (event.category === "content") existing.contentCount += 1;
    if (event.action === "navigation.page_view") existing.pageViewCount += 1;
    if (event.action === "ui.click") existing.clickCount += 1;
    if (event.createdAt > existing.lastSeenAt) existing.lastSeenAt = event.createdAt;
    if (event.createdAt < existing.firstSeenAt) existing.firstSeenAt = event.createdAt;
    if (!existing.actorUserId && event.actorUserId) {
      existing.actorUserId = event.actorUserId;
    }
    if (!existing.actorRole && event.actorRole) {
      existing.actorRole = event.actorRole;
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.eventCount !== a.eventCount) return b.eventCount - a.eventCount;
    return b.lastSeenAt.localeCompare(a.lastSeenAt);
  });
}

export function AuditDayCalendar() {
  const [selectedDate, setSelectedDate] = useState(() => getTehranCalendarDateIso());
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<AuditCategory | "all">("all");
  const [selectedActorKey, setSelectedActorKey] = useState<string | null>(null);

  const todayIso = getTehranCalendarDateIso();
  const yesterdayIso = getTehranOffsetDateIso(-1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelectedActorKey(null);

    void getAuditEventsForDayAction(selectedDate).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error);
        setEvents([]);
      } else {
        setEvents(result.events);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedDate]);

  const actors = useMemo(() => aggregateDayActors(events), [events]);

  const daySummary = useMemo(() => {
    let logins = 0;
    let contentChanges = 0;
    let pageViews = 0;
    let clicks = 0;
    for (const event of events) {
      if (event.action === "auth.login") logins += 1;
      if (event.category === "content") contentChanges += 1;
      if (event.action === "navigation.page_view") pageViews += 1;
      if (event.action === "ui.click") clicks += 1;
    }
    return {
      totalEvents: events.length,
      logins,
      uniqueUsers: actors.length,
      contentChanges,
      pageViews,
      clicks,
    };
  }, [events, actors.length]);

  const filteredEvents = useMemo(() => {
    const term = search.trim().toLowerCase();
    return events.filter((event) => {
      if (categoryFilter !== "all" && event.category !== categoryFilter) return false;

      if (selectedActorKey) {
        const key =
          event.actorUserId ||
          event.actorEmail?.trim().toLowerCase() ||
          event.actorName?.trim() ||
          "anonymous";
        if (key !== selectedActorKey) return false;
      }

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
  }, [events, search, categoryFilter, selectedActorKey]);

  const loginsForDay = useMemo(
    () => events.filter((event) => event.action === "auth.login"),
    [events]
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-end gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Button
                type="button"
                variant="outline"
                size="icon"
                data-audit-label="روز قبل در تقویم رصد"
                onClick={() => setSelectedDate((date) => shiftIsoDate(date, -1))}
                aria-label="روز قبل"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <div className="w-full max-w-[220px]">
                <PersianDateInput value={selectedDate} onChange={setSelectedDate} />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                data-audit-label="روز بعد در تقویم رصد"
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
                data-audit-label="امروز در تقویم رصد"
                onClick={() => setSelectedDate(todayIso)}
              >
                امروز
              </Button>
              <Button
                type="button"
                size="sm"
                variant={selectedDate === yesterdayIso ? "default" : "outline"}
                data-audit-label="دیروز در تقویم رصد"
                onClick={() => setSelectedDate(yesterdayIso)}
              >
                دیروز
              </Button>
            </div>

            <p className="text-sm text-muted-foreground lg:mr-auto flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 shrink-0" />
              فعالیت‌های {formatPersianDateShort(selectedDate)}
            </p>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            در حال بارگذاری فعالیت‌های این روز…
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <DayStat label="کاربران فعال" value={daySummary.uniqueUsers} icon={Users} />
            <DayStat label="ورود" value={daySummary.logins} icon={LogIn} />
            <DayStat label="رویداد" value={daySummary.totalEvents} icon={CalendarDays} />
            <DayStat label="محتوا" value={daySummary.contentChanges} icon={FileStack} />
            <DayStat label="بازدید صفحه" value={daySummary.pageViews} icon={Navigation} />
            <DayStat label="کلیک" value={daySummary.clicks} icon={MousePointerClick} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  کاربران فعال در این روز
                  <Badge variant="outline">{formatPersianNumber(actors.length)}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {actors.length === 0 ? (
                  <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                    در این تاریخ فعالیتی ثبت نشده است.
                  </p>
                ) : (
                  <ul className="divide-y max-h-[420px] overflow-y-auto">
                    {actors.map((actor) => {
                      const { displayName, showEmail, email } = resolveUserDisplay(
                        actor.actorName,
                        actor.actorEmail
                      );
                      const isSelected = selectedActorKey === actor.actorKey;
                      return (
                        <li key={actor.actorKey}>
                          <button
                            type="button"
                            data-audit-label={`فیلتر کاربر روز: ${displayName}`}
                            onClick={() =>
                              setSelectedActorKey((current) =>
                                current === actor.actorKey ? null : actor.actorKey
                              )
                            }
                            className={`w-full text-right px-4 py-3 transition-colors hover:bg-muted/40 ${
                              isSelected ? "bg-primary/5" : ""
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-medium truncate">{displayName}</p>
                                {showEmail && email && (
                                  <p className="text-xs text-muted-foreground truncate" dir="ltr">
                                    {email}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground mt-1">
                                  {actor.actorRole
                                    ? getAuditRoleLabel(actor.actorRole)
                                    : "بدون نقش"}{" "}
                                  · از {formatPersianDateTime(actor.firstSeenAt)} تا{" "}
                                  {formatPersianDateTime(actor.lastSeenAt)}
                                </p>
                              </div>
                              <div className="shrink-0 text-left space-y-1">
                                <Badge variant={isSelected ? "default" : "outline"}>
                                  {formatPersianNumber(actor.eventCount)} رویداد
                                </Badge>
                                <div className="flex flex-wrap justify-end gap-1 text-[11px] text-muted-foreground">
                                  {actor.loginCount > 0 && (
                                    <span>ورود {formatPersianNumber(actor.loginCount)}</span>
                                  )}
                                  {actor.contentCount > 0 && (
                                    <span>محتوا {formatPersianNumber(actor.contentCount)}</span>
                                  )}
                                  {actor.pageViewCount > 0 && (
                                    <span>بازدید {formatPersianNumber(actor.pageViewCount)}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  ورودهای این روز
                  <Badge variant="outline">{formatPersianNumber(loginsForDay.length)}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loginsForDay.length === 0 ? (
                  <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                    در این تاریخ ورودی ثبت نشده است.
                  </p>
                ) : (
                  <ul className="divide-y max-h-[420px] overflow-y-auto">
                    {loginsForDay.map((event) => {
                      const { displayName, showEmail, email } = resolveUserDisplay(
                        event.actorName,
                        event.actorEmail
                      );
                      return (
                        <li key={event.id} className="px-4 py-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{displayName}</p>
                            {showEmail && email && (
                              <p className="text-xs text-muted-foreground truncate" dir="ltr">
                                {email}
                              </p>
                            )}
                            {event.actorRole && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {getAuditRoleLabel(event.actorRole)}
                              </p>
                            )}
                          </div>
                          <div className="shrink-0 text-left text-xs text-muted-foreground space-y-0.5">
                            <p>{formatPersianDateTime(event.createdAt)}</p>
                            {event.ipAddress && (
                              <p className="font-mono" dir="ltr">
                                {event.ipAddress}
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3 space-y-3">
              <CardTitle className="text-base flex flex-wrap items-center gap-2">
                رویدادهای این روز
                <Badge variant="outline">{formatPersianNumber(filteredEvents.length)}</Badge>
                {selectedActorKey && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    data-audit-label="حذف فیلتر کاربر روز"
                    onClick={() => setSelectedActorKey(null)}
                  >
                    حذف فیلتر کاربر
                  </Button>
                )}
              </CardTitle>
              <div className="flex flex-col sm:flex-row gap-3">
                <Input
                  placeholder="جستجو در رویدادهای این روز…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="sm:max-w-xs"
                />
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    data-audit-label="فیلتر تقویم: همه"
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
                      data-audit-label={`فیلتر تقویم: ${AUDIT_CATEGORY_LABELS[category]}`}
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
            </CardHeader>
            <CardContent className="p-0">
              {filteredEvents.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  رویدادی برای این فیلتر یافت نشد.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table
                    className="w-full border-collapse text-sm"
                    style={{ minWidth: "900px", direction: "rtl" }}
                  >
                    <thead>
                      <tr className="bg-muted/50 text-muted-foreground">
                        <th className="border-b px-3 py-3 text-right font-medium whitespace-nowrap">
                          زمان
                        </th>
                        <th className="border-b px-3 py-3 text-right font-medium whitespace-nowrap">
                          کاربر
                        </th>
                        <th className="border-b px-3 py-3 text-right font-medium whitespace-nowrap">
                          دسته
                        </th>
                        <th className="border-b px-3 py-3 text-right font-medium whitespace-nowrap">
                          اقدام
                        </th>
                        <th className="border-b px-3 py-3 text-right font-medium whitespace-nowrap">
                          مورد
                        </th>
                        <th className="border-b px-3 py-3 text-right font-medium whitespace-nowrap">
                          توضیح
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEvents.map((event) => {
                        const { displayName, showEmail, email } = resolveUserDisplay(
                          event.actorName,
                          event.actorEmail
                        );
                        return (
                          <tr key={event.id} className="border-b last:border-0">
                            <td className="px-3 py-3 text-right align-middle whitespace-nowrap text-xs text-muted-foreground">
                              {formatPersianDateTime(event.createdAt)}
                            </td>
                            <td className="px-3 py-3 text-right align-middle whitespace-nowrap">
                              <div className="min-w-0 text-right">
                                <div className="font-medium truncate" title={displayName}>
                                  {displayName}
                                </div>
                                {showEmail && email && (
                                  <div
                                    className="text-xs text-muted-foreground truncate"
                                    dir="ltr"
                                    title={email}
                                  >
                                    {email}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-3 text-right align-middle whitespace-nowrap">
                              <Badge variant={CATEGORY_BADGE_VARIANT[event.category]}>
                                {AUDIT_CATEGORY_LABELS[event.category]}
                              </Badge>
                            </td>
                            <td className="px-3 py-3 text-right align-middle whitespace-nowrap">
                              {getAuditActionLabel(event.action)}
                            </td>
                            <td className="px-3 py-3 text-right align-middle whitespace-nowrap">
                              {getAuditEntityLabel(event.entityType)}
                            </td>
                            <td className="px-3 py-3 text-right align-middle !whitespace-normal">
                              <span className="line-clamp-2 break-words">
                                {event.label?.trim() || event.path || "—"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function DayStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: typeof Users;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold">{formatPersianNumber(value)}</p>
          </div>
          <Icon className="h-4 w-4 text-primary shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}
