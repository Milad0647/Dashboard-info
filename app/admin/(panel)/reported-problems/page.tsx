import { redirect } from "next/navigation";
import {
  CheckCircle2,
  Clock3,
  MessageSquareReply,
  TriangleAlert,
} from "lucide-react";
import { AuditProblemsPanel } from "@/components/admin/audit-problems-panel";
import { Card, CardContent } from "@/components/ui/card";
import { getAuthSession, isFullAdmin } from "@/lib/auth/get-session";
import type { ProblemReport, ProblemReportStats } from "@/lib/audit/problem-types";
import {
  pgGetProblemReportStats,
  pgListProblemReports,
} from "@/lib/db/problem-reports-repository";
import {
  formatPersianDurationFromSeconds,
  formatPersianNumber,
  isPostgresConfigured,
} from "@/lib/utils";
import { withFileAccessTokensDeep } from "@/lib/uploads";

export const dynamic = "force-dynamic";

const EMPTY_STATS: ProblemReportStats = {
  total: 0,
  open: 0,
  pending: 0,
  inProgress: 0,
  answered: 0,
  resolved: 0,
  dismissed: 0,
  avgFirstReplySeconds: null,
};

async function safeTimed<T>(fn: () => Promise<T>, fallback: T, timeoutMs = 8_000): Promise<T> {
  try {
    return await Promise.race([
      fn(),
      new Promise<T>((_, reject) => {
        setTimeout(
          () => reject(new Error(`reported-problems query timed out after ${timeoutMs}ms`)),
          timeoutMs
        );
      }),
    ]);
  } catch (error) {
    console.error("Reported problems partial load failed:", error);
    return fallback;
  }
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: typeof TriangleAlert;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold truncate">{value}</p>
            {hint ? <p className="text-xs text-muted-foreground mt-1">{hint}</p> : null}
          </div>
          <Icon className="h-5 w-5 text-primary shrink-0" />
        </div>
      </CardContent>
    </Card>
  );
}

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
            رسیدگی به گزارش‌های مشکل کاربران.
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

  const [reports, stats] = await Promise.all([
    safeTimed<ProblemReport[]>(() => pgListProblemReports({ limit: 100 }), []),
    safeTimed(() => pgGetProblemReportStats(), EMPTY_STATS),
  ]);

  const avgReplyLabel =
    stats.avgFirstReplySeconds === null
      ? "—"
      : formatPersianDurationFromSeconds(stats.avgFirstReplySeconds);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TriangleAlert className="h-6 w-6 text-amber-500" />
          مشکلات ثبت‌شده
          {stats.open > 0 && (
            <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
              ({formatPersianNumber(stats.open)} باز)
            </span>
          )}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          گزارش‌های مشکل کاربران را ببینید، پاسخ بدهید و وضعیت را به‌روز کنید — شامل تیکت‌هایی که
          پاسخ داده شده‌اند.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="کل تیکت‌ها"
          value={formatPersianNumber(stats.total)}
          icon={TriangleAlert}
          hint={`${formatPersianNumber(stats.pending)} در انتظار · ${formatPersianNumber(stats.inProgress)} در حال بررسی`}
        />
        <StatCard
          label="باز"
          value={formatPersianNumber(stats.open)}
          icon={TriangleAlert}
          hint="در انتظار یا در حال بررسی"
        />
        <StatCard
          label="پاسخ داده‌شده"
          value={formatPersianNumber(stats.answered)}
          icon={MessageSquareReply}
          hint={`${formatPersianNumber(stats.resolved)} حل‌شده · ${formatPersianNumber(stats.dismissed)} بسته‌شده`}
        />
        <StatCard
          label="میانگین زمان پاسخ"
          value={avgReplyLabel}
          icon={stats.avgFirstReplySeconds === null ? Clock3 : CheckCircle2}
          hint={
            stats.answered > 0
              ? `بر اساس ${formatPersianNumber(stats.answered)} تیکت پاسخ‌داده‌شده`
              : "هنوز پاسخی ثبت نشده"
          }
        />
      </div>

      <AuditProblemsPanel reports={withFileAccessTokensDeep(reports)} showSignals={false} />
    </div>
  );
}
