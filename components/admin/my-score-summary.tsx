"use client";

import { Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { UserLeaderboardEntry } from "@/lib/city-leaderboard";
import { formatPersianNumber } from "@/lib/utils";

interface MyScoreSummaryProps {
  entry: UserLeaderboardEntry | null;
}

const SECTIONS: {
  label: string;
  approvedKey: keyof UserLeaderboardEntry;
  pendingKey: keyof UserLeaderboardEntry;
}[] = [
  { label: "تبلیغات محیطی", approvedKey: "billboardScore", pendingKey: "pendingBillboardScore" },
  { label: "پوستر", approvedKey: "posterScore", pendingKey: "pendingPosterScore" },
  { label: "ویدیو", approvedKey: "videoScore", pendingKey: "pendingVideoScore" },
  { label: "شبکه / سایت", approvedKey: "socialScore", pendingKey: "pendingSocialScore" },
];

export function MyScoreSummary({ entry }: MyScoreSummaryProps) {
  if (!entry) return null;

  const approved = entry.ratingScore ?? 0;
  const pending = entry.pendingScore ?? 0;

  return (
    <Card className="border-primary/20 bg-primary/5 shadow-none">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Star className="size-4 text-amber-500" />
          امتیازهای من
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border bg-background/80 p-3">
            <p className="text-xs text-muted-foreground">تأییدشده (رسمی)</p>
            <p className="text-2xl font-semibold tabular-nums mt-1">
              {formatPersianNumber(approved)}
            </p>
          </div>
          <div className="rounded-lg border bg-background/80 p-3">
            <p className="text-xs text-muted-foreground">در انتظار تأیید</p>
            <p className="text-2xl font-semibold tabular-nums mt-1 text-amber-700 dark:text-amber-400">
              {formatPersianNumber(pending)}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {SECTIONS.map((section) => {
            const a = Number(entry[section.approvedKey] ?? 0);
            const p = Number(entry[section.pendingKey] ?? 0);
            if (a <= 0 && p <= 0) return null;
            return (
              <div
                key={section.label}
                className="flex items-center justify-between gap-2 text-sm border-b border-border/50 pb-2 last:border-0"
              >
                <span className="text-muted-foreground">{section.label}</span>
                <span className="tabular-nums">
                  {formatPersianNumber(a)}
                  {p > 0 && (
                    <span className="text-amber-700 dark:text-amber-400 mr-2">
                      {" "}
                      · {formatPersianNumber(p)} در انتظار
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-muted-foreground leading-relaxed">
          امتیاز رسمی فقط بعد از تأیید محتوا در رتبه‌بندی لحاظ می‌شود. اگر محتوا یک‌بار برگشت خورده
          باشد، بعد از تأیید نصف امتیاز ثبت می‌شود.
        </p>
      </CardContent>
    </Card>
  );
}
