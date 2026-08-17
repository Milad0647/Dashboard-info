"use client";

import { Clock, LogIn } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  CompanyDayActivityEvent,
  CompanyDayActivityResult,
} from "@/lib/actions/audit-actions";
import { dayPositionPercent } from "@/lib/safe-dates";
import {
  formatPersianDurationFromSeconds,
  formatPersianNumber,
  formatTehranClock,
} from "@/lib/utils";

function PresenceBar({
  dateIso,
  sessions,
  loginEvents,
}: {
  dateIso: string;
  sessions: CompanyDayActivityResult["sessions"];
  loginEvents: CompanyDayActivityEvent[];
}) {
  return (
    <div className="space-y-2" dir="ltr">
      <div className="relative h-10 overflow-hidden rounded-lg border bg-muted/60">
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
        {loginEvents.map((event) => (
          <div
            key={event.id}
            className="absolute top-0 bottom-0 w-0.5 bg-emerald-500"
            style={{ left: `${dayPositionPercent(event.createdAt, dateIso)}%` }}
            title={`${formatTehranClock(event.createdAt)} — ورود`}
          />
        ))}
      </div>
      <div className="flex justify-between px-0.5 text-[11px] text-muted-foreground">
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
      </div>
    </div>
  );
}

export function CompanyPresenceTimeline({
  activity,
  loading,
}: {
  activity: CompanyDayActivityResult | null;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <Clock className="h-4 w-4 text-primary" />
          خط زمانی ورود امروز
          {activity ? (
            <Badge variant="outline">
              {formatPersianDurationFromSeconds(activity.onlineSeconds)} آنلاین
            </Badge>
          ) : null}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            در حال بارگذاری حضور امروز...
          </p>
        ) : !activity ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            برای این ردیف شناسه کاربر ثبت نشده یا داده حضور در دسترس نیست.
          </p>
        ) : (
          <>
            <PresenceBar
              dateIso={activity.date}
              sessions={activity.sessions}
              loginEvents={activity.loginEvents}
            />

            {activity.sessions.length === 0 ? (
              <p className="py-2 text-center text-sm text-muted-foreground">
                امروز ورود یا حضور آنلاینی ثبت نشده است.
              </p>
            ) : (
              <ul className="space-y-2">
                {activity.sessions.map((session, index) => (
                  <li
                    key={`${session.startAt}-${session.endAt}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                  >
                    <span className="font-medium">
                      نشست {formatPersianNumber(index + 1)}
                    </span>
                    <span className="text-muted-foreground">
                      {formatTehranClock(session.startAt)} تا {formatTehranClock(session.endAt)}
                    </span>
                    <Badge variant="outline">
                      {formatPersianDurationFromSeconds(session.durationSeconds)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}

            {activity.loginEvents.length > 0 ? (
              <div className="space-y-2">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <LogIn className="h-4 w-4" />
                  ورودهای امروز ({formatPersianNumber(activity.loginEvents.length)})
                </p>
                <ul className="space-y-1.5">
                  {activity.loginEvents.map((event) => (
                    <li
                      key={event.id}
                      className="rounded-lg border bg-muted/30 px-3 py-2 text-sm"
                    >
                      <span className="font-medium tabular-nums">
                        {formatTehranClock(event.createdAt)}
                      </span>
                      {event.label?.trim() ? (
                        <span className="text-muted-foreground"> — {event.label}</span>
                      ) : (
                        <span className="text-muted-foreground"> — ورود به سامانه</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
