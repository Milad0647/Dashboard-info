"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateProblemReportStatusAction } from "@/lib/actions/problem-report-actions";
import {
  PROBLEM_REPORT_CATEGORY_LABELS,
  PROBLEM_REPORT_STATUS_LABELS,
  STUCK_SIGNAL_KIND_LABELS,
  type ProblemReport,
  type ProblemReportStatus,
  type StuckBehaviorSignal,
} from "@/lib/audit/problem-types";
import { getAuditRoleLabel } from "@/lib/audit/labels";
import { formatPersianDateTime, formatPersianNumber } from "@/lib/utils";

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

function resolveName(name?: string | null, email?: string | null) {
  return name?.trim() || email?.trim() || "ناشناس";
}

export function AuditProblemsPanel({
  reports,
  signals,
}: {
  reports: ProblemReport[];
  signals: StuckBehaviorSignal[];
}) {
  const [statusFilter, setStatusFilter] = useState<ProblemReportStatus | "open" | "all">(
    "open"
  );
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const filteredReports = useMemo(() => {
    if (statusFilter === "all") return reports;
    if (statusFilter === "open") {
      return reports.filter((r) => r.status === "pending" || r.status === "in_progress");
    }
    return reports.filter((r) => r.status === statusFilter);
  }, [reports, statusFilter]);

  const handleStatus = async (id: string, status: ProblemReportStatus) => {
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
      toast.success("وضعیت گزارش به‌روز شد");
    } catch {
      toast.error("خطا در به‌روزرسانی گزارش");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
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
            سیستم از روی کلیک‌های تکراری، رفت‌وآمد زیاد در یک صفحه و ورودهای ناموفق،
            کاربرانی را که احتمالاً مشکل دارند تشخیص می‌دهد.
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

      <Card>
        <CardHeader className="pb-2 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              گزارش‌های مشکل کاربران
              <Badge variant="warning">
                {formatPersianNumber(
                  reports.filter((r) => r.status === "pending" || r.status === "in_progress")
                    .length
                )}{" "}
                باز
              </Badge>
            </CardTitle>
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as ProblemReportStatus | "open" | "all")
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">بازها</SelectItem>
                <SelectItem value="all">همه</SelectItem>
                <SelectItem value="pending">در انتظار</SelectItem>
                <SelectItem value="in_progress">در حال بررسی</SelectItem>
                <SelectItem value="resolved">حل شده</SelectItem>
                <SelectItem value="dismissed">بسته شده</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {filteredReports.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              گزارشی در این فیلتر نیست.
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

                {report.path && (
                  <p className="text-xs text-muted-foreground font-mono" dir="ltr">
                    صفحه: {report.path}
                  </p>
                )}

                {report.adminNote && (
                  <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
                    <span className="font-medium">یادداشت ادمین: </span>
                    {report.adminNote}
                  </div>
                )}

                <div className="space-y-2">
                  <Textarea
                    placeholder="یادداشت رسیدگی (اختیاری)…"
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
