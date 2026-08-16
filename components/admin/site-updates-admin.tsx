import { Rocket } from "lucide-react";
import {
  groupSiteUpdatesByDay,
  type SiteUpdateEntry,
} from "@/lib/site-updates";
import { Badge } from "@/components/ui/badge";
import { formatPersianDate, formatPersianNumber } from "@/lib/utils";

interface SiteUpdatesAdminProps {
  entries: SiteUpdateEntry[];
}

function formatTime(committedAt: string): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Tehran",
    }).format(new Date(committedAt));
  } catch {
    return "";
  }
}

export function SiteUpdatesAdmin({ entries }: SiteUpdatesAdminProps) {
  const groups = groupSiteUpdatesByDay(entries);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Rocket className="h-6 w-6 text-primary" />
            آپدیت‌های سایت
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            تغییرات و امکانات جدیدی که به داشبورد اضافه شده است — به ترتیب از جدیدترین.
          </p>
        </div>
        <Badge variant="secondary" className="text-xs">
          {formatPersianNumber(entries.length)} به‌روزرسانی
        </Badge>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          هنوز آپدیتی ثبت نشده است.
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <section key={group.day} className="space-y-3">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold text-primary">
                  {formatPersianDate(group.day)}
                </h2>
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">
                  {formatPersianNumber(group.items.length)} مورد
                </span>
              </div>
              <ul className="space-y-2">
                {group.items.map((entry) => (
                  <li
                    key={entry.hash}
                    className="flex items-start gap-3 rounded-xl border bg-card px-4 py-3"
                  >
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-6">{entry.title}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground" dir="ltr">
                      {formatTime(entry.committedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
