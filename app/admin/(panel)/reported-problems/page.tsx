import { redirect } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { AuditProblemsPanel } from "@/components/admin/audit-problems-panel";
import { Card, CardContent } from "@/components/ui/card";
import { getAuthSession, isFullAdmin } from "@/lib/auth/get-session";
import { pgCountOpenProblemReports, pgListProblemReports } from "@/lib/db/problem-reports-repository";
import { pgGetStuckBehaviorSignals } from "@/lib/db/stuck-signals-repository";
import { formatPersianNumber, isPostgresConfigured } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ReportedProblemsPage() {
  const session = await getAuthSession();
  if (!session) redirect("/admin/login");
  if (!isFullAdmin(session)) redirect("/admin");

  if (!isPostgresConfigured()) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TriangleAlert className="h-6 w-6 text-amber-500" />
            مشکلات ثبت‌شده
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            رسیدگی به گزارش‌های مشکل کاربران و سیگنال‌های گیر کردن.
          </p>
        </div>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            این بخش فقط با اتصال به پایگاه داده فعال است.
          </CardContent>
        </Card>
      </div>
    );
  }

  const [reports, openCount, signals] = await Promise.all([
    pgListProblemReports({ limit: 100 }),
    pgCountOpenProblemReports(),
    pgGetStuckBehaviorSignals(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TriangleAlert className="h-6 w-6 text-amber-500" />
          مشکلات ثبت‌شده
          {openCount > 0 && (
            <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
              ({formatPersianNumber(openCount)} باز)
            </span>
          )}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          گزارش‌های مشکل کاربران را ببینید، پاسخ بدهید و وضعیت را به‌روز کنید.
        </p>
      </div>

      <AuditProblemsPanel reports={reports} signals={signals} />
    </div>
  );
}
