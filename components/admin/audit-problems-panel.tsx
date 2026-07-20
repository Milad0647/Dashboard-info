"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { updateProblemReportStatusAction } from "@/lib/actions/problem-report-actions";
import {
  parseProblemReportAttachments,
  PROBLEM_REPORT_CATEGORY_LABELS,
  PROBLEM_REPORT_STATUS_LABELS,
  STUCK_SIGNAL_KIND_LABELS,
  type ProblemReport,
  type ProblemReportStatus,
  type StuckBehaviorSignal,
} from "@/lib/audit/problem-types";
import { getAuditRoleLabel } from "@/lib/audit/labels";
import { formatPersianDateTime, formatPersianNumber } from "@/lib/utils";
import { ProblemReportAttachmentsView } from "@/components/admin/problem-report-attachments";

const STATUS_BADGE: Record<
  ProblemReportStatus,
  "warning" | "default" | "success" | "outline"
> = {
  pending: "warning",
  in_progress: "default",
  resolved: "success",
  dismissed: "outline",
};

const SEVERITY_BADGE: Record<
  StuckBehaviorSignal["severity"],
  "destructive" | "warning" | "outline"
> = {
  high: "destructive",
  medium: "warning",
  low: "outline",
};

const SEVERITY_LABEL: Record<StuckBehaviorSignal["severity"], string> = {
  high: "بالا",
  medium: "متوسط",
  low: "کم",
};

type ProblemTab = "open" | "in_progress" | "resolved";

function resolveName(name?: string | null, email?: string | null) {
  return name?.trim() || email?.trim() || "ناشناس";
}

function matchesTab(report: ProblemReport, tab: ProblemTab): boolean {
  if (tab === "open") return report.status === "pending";
  if (tab === "in_progress") return report.status === "in_progress";
  return report.status === "resolved" || report.status === "dismissed";
}

export function AuditProblemsPanel({
  reports,
  signals = [],
  showSignals = true,
}: {
  reports: ProblemReport[];
  signals?: StuckBehaviorSignal[];
  /** When false, hides stuck-behavior card (e.g. dedicated reported-problems page). */
  showSignals?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<ProblemTab>("open");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const tabCounts = useMemo(
    () => ({
      open: reports.filter((r) => r.status === "pending").length,
      in_progress: reports.filter((r) => r.status === "in_progress").length,
      resolved: reports.filter(
        (r) => r.status === "resolved" || r.status === "dismissed"
      ).length,
    }),
    [reports]
  );

  const filteredReports = useMemo(
    () => reports.filter((r) => matchesTab(r, activeTab)),
    [reports, activeTab]
  );

  const handleStatus = async (
    id: string,
    status: ProblemReportStatus,
    options?: { replyOnly?: boolean }
  ) => {
    setBusyId(id);
    try {
      const result = await updateProblemReportStatusAction({
        id,
        status,
        adminNote: notes[id],
      });
      if (!result.success) {
        toast.error(result.error ?? "به‌روزرسانی ناموفق بود");
        return;
      }
      toast.success(options?.replyOnly ? "پاسخ برای کاربر ارسال شد" : "وضعیت گزارش به‌روز شد");
    } catch (error) {
      console.error("handleStatus failed:", error);
      toast.error("خطا در به‌روزرسانی گزارش");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {showSignals ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TriangleAlert className="h-4 w-4 text-amber-500" />
              هشدار رفتار مشکوک / گیر کرده
              <Badge variant="warning">{formatPersianNumber(signals.length)}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              سیستم از روی کلیک‌های تکراری روی ذخیره/افزودن/ویرایش/بستن/ثبت جدید، خطاهای پیاپی
              کاربر و ورودهای ناموفق، گیر کردن در ثبت محتوا را تشخیص می‌دهد.
            </p>
            {signals.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                فعلاً هشدار رفتاری ثبت نشده است.
              </p>
            ) : (
              <div className="space-y-3">
                {signals.map((signal) => (
                  <div key={signal.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2 justify-between">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={SEVERITY_BADGE[signal.severity]}>
                          شدت {SEVERITY_LABEL[signal.severity]}
                        </Badge>
                        <Badge variant="outline">{STUCK_SIGNAL_KIND_LABELS[signal.kind]}</Badge>
                        <span className="font-medium">
                          {resolveName(signal.actorName, signal.actorEmail)}
                        </span>
                        {signal.actorRole && (
                          <Badge variant="outline">{getAuditRoleLabel(signal.actorRole)}</Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatPersianNumber(signal.count)} بار ·{" "}
                        {formatPersianDateTime(signal.lastSeenAt)}
                      </span>
                    </div>
                    <p className="text-sm font-medium">{signal.title}</p>
                    <p className="text-sm text-muted-foreground">{signal.detail}</p>
                    {signal.recentErrors && signal.recentErrors.length > 0 && (
                      <div className="rounded-md bg-destructive/5 border border-destructive/20 px-3 py-2 space-y-1">
                        <p className="text-xs font-medium text-destructive">خطاهای اخیر کاربر:</p>
                        <ul className="text-xs text-muted-foreground space-y-0.5 list-disc list-inside">
                          {signal.recentErrors.map((errorMessage) => (
                            <li key={errorMessage}>{errorMessage}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {(signal.path || signal.label) && (
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {signal.label && <span>کنترل: {signal.label}</span>}
                        {signal.path && (
                          <span dir="ltr" className="font-mono">
                            {signal.path}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="pb-2 space-y-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            گزارش‌های مشکل کاربران
          </CardTitle>
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as ProblemTab)}
          >
            <TabsList className="w-full sm:w-auto">
              <TabsTrigger value="open" className="gap-1.5">
                مشکلات باز
                <Badge
                  variant={activeTab === "open" ? "warning" : "outline"}
                  className="text-[10px] px-1.5 py-0"
                >
                  {formatPersianNumber(tabCounts.open)}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="in_progress" className="gap-1.5">
                در حال بررسی
                <Badge
                  variant={activeTab === "in_progress" ? "default" : "outline"}
                  className="text-[10px] px-1.5 py-0"
                >
                  {formatPersianNumber(tabCounts.in_progress)}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="resolved" className="gap-1.5">
                مشکلات حل‌شده
                <Badge
                  variant={activeTab === "resolved" ? "success" : "outline"}
                  className="text-[10px] px-1.5 py-0"
                >
                  {formatPersianNumber(tabCounts.resolved)}
                </Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="space-y-4">
          {filteredReports.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {activeTab === "open"
                ? "مشکل بازی ثبت نشده است."
                : activeTab === "in_progress"
                  ? "مشکلی در حال بررسی نیست."
                  : "مشکل حل‌شده‌ای نیست."}
            </p>
          ) : (
            filteredReports.map((report) => (
              <div key={report.id} className="rounded-lg border p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={STATUS_BADGE[report.status]}>
                        {PROBLEM_REPORT_STATUS_LABELS[report.status]}
                      </Badge>
                      <Badge variant="outline">
                        {PROBLEM_REPORT_CATEGORY_LABELS[report.category]}
                      </Badge>
                      {report.adminNote ? (
                        <Badge variant="success">پاسخ داده‌شده</Badge>
                      ) : null}
                    </div>
                    <h3 className="font-semibold text-base">{report.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {resolveName(report.reporterName, report.reporterEmail)}
                      {report.reporterRole
                        ? ` · ${getAuditRoleLabel(report.reporterRole)}`
                        : ""}
                      {" · "}
                      {formatPersianDateTime(report.createdAt)}
                    </p>
                  </div>
                </div>

                <p className="text-sm whitespace-pre-wrap">{report.description}</p>

                <ProblemReportAttachmentsView
                  attachments={parseProblemReportAttachments(report.metadata)}
                />

                {report.path && (
                  <p className="text-xs text-muted-foreground font-mono" dir="ltr">
                    صفحه: {report.path}
                  </p>
                )}

                {report.adminNote && (
                  <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                    <span className="font-medium">پاسخ فعلی به کاربر: </span>
                    {report.adminNote}
                  </div>
                )}

                <div className="space-y-2">
                  <Textarea
                    placeholder="پاسخ به کاربر (برای گزارش‌دهنده قابل مشاهده است)…"
                    value={notes[report.id] ?? report.adminNote ?? ""}
                    onChange={(event) =>
                      setNotes((prev) => ({ ...prev, [report.id]: event.target.value }))
                    }
                    className="min-h-[70px]"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={
                        busyId === report.id ||
                        !(notes[report.id] ?? report.adminNote ?? "").trim()
                      }
                      onClick={() =>
                        handleStatus(
                          report.id,
                          report.status === "pending" ? "in_progress" : report.status,
                          { replyOnly: true }
                        )
                      }
                      data-audit-label="ارسال پاسخ گزارش مشکل"
                    >
                      {busyId === report.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      ارسال پاسخ
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busyId === report.id || report.status === "in_progress"}
                      onClick={() => handleStatus(report.id, "in_progress")}
                      data-audit-label="شروع بررسی گزارش مشکل"
                    >
                      {busyId === report.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : null}
                      شروع بررسی
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={busyId === report.id}
                      onClick={() => handleStatus(report.id, "resolved")}
                      data-audit-label="حل گزارش مشکل"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      حل شد
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busyId === report.id}
                      onClick={() => handleStatus(report.id, "dismissed")}
                      data-audit-label="بستن گزارش مشکل"
                    >
                      بستن بدون اقدام
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
