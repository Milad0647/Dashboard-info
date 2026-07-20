"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { AlertTriangle, Loader2, MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ProblemReportAttachmentsField,
  ProblemReportAttachmentsView,
} from "@/components/admin/problem-report-attachments";
import {
  getMyUnreadProblemReplyCountAction,
  listMyProblemReportsAction,
  markMyProblemReportsSeenAction,
  submitProblemReportAction,
  type MyProblemReport,
} from "@/lib/actions/problem-report-actions";
import {
  PROBLEM_REPORT_CATEGORY_LABELS,
  PROBLEM_REPORT_STATUS_LABELS,
  type ProblemReportAttachment,
  type ProblemReportCategory,
  type ProblemReportStatus,
} from "@/lib/audit/problem-types";
import { formatPersianDateTime } from "@/lib/utils";
import { emitProblemReportsUnreadChanged } from "@/lib/problem-reports-unread";

const CATEGORIES = Object.keys(PROBLEM_REPORT_CATEGORY_LABELS) as ProblemReportCategory[];

const STATUS_BADGE: Record<
  ProblemReportStatus,
  "warning" | "default" | "success" | "outline"
> = {
  pending: "warning",
  in_progress: "default",
  resolved: "success",
  dismissed: "outline",
};

export function ProblemReportButton() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"new" | "history">("new");
  const [category, setCategory] = useState<ProblemReportCategory>("other");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [attachments, setAttachments] = useState<ProblemReportAttachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [myReports, setMyReports] = useState<MyProblemReport[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const reset = () => {
    setCategory("other");
    setTitle("");
    setDescription("");
    setAttachments([]);
    setTab("new");
  };

  const refreshUnreadBadge = async () => {
    try {
      const result = await getMyUnreadProblemReplyCountAction();
      const count = result.success ? (result.count ?? 0) : 0;
      setUnreadCount(count);
      emitProblemReportsUnreadChanged(count);
    } catch {
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    void refreshUnreadBadge();
    const timer = window.setInterval(() => {
      void refreshUnreadBadge();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const loadHistory = async (options?: { markSeen?: boolean }) => {
    setHistoryLoading(true);
    try {
      const result = await listMyProblemReportsAction();
      if (!result.success) {
        toast.error(result.error ?? "بارگذاری گزارش‌ها ناموفق بود");
        setMyReports([]);
        return;
      }

      const reports = result.reports ?? [];
      const hasUnread = reports.some((report) => report.hasUnreadReply);
      const nextUnread = reports.filter((report) => report.hasUnreadReply).length;

      setMyReports(reports);

      if (options?.markSeen && hasUnread) {
        const seenResult = await markMyProblemReportsSeenAction();
        // Clear nav / button red-dot; keep local "پاسخ جدید" badges for this open.
        if (seenResult.success) {
          setUnreadCount(0);
          emitProblemReportsUnreadChanged(0);
        } else {
          setUnreadCount(nextUnread);
          emitProblemReportsUnreadChanged(nextUnread);
        }
      } else {
        setUnreadCount(nextUnread);
        emitProblemReportsUnreadChanged(nextUnread);
      }
    } catch {
      toast.error("بارگذاری گزارش‌ها با خطا مواجه شد");
      setMyReports([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      reset();
      return;
    }
    const openOnHistory = unreadCount > 0;
    setTab(openOnHistory ? "history" : "new");
    void loadHistory({ markSeen: openOnHistory });
  };

  const handleTabChange = (value: string) => {
    const next = value as "new" | "history";
    setTab(next);
    if (next === "history") {
      void loadHistory({ markSeen: true });
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const campaignId = searchParams.get("campaign");
      const query = searchParams.toString();
      const path = query ? `${pathname}?${query}` : pathname;

      const result = await submitProblemReportAction({
        category,
        title,
        description,
        path,
        campaignId,
        attachments,
      });

      if (!result.success) {
        toast.error(result.error ?? "ارسال گزارش ناموفق بود");
        return;
      }

      toast.success("گزارش مشکل ثبت شد. ادمین رسیدگی می‌کند.");
      reset();
      setTab("history");
      await loadHistory({ markSeen: true });
    } catch {
      toast.error("ارسال گزارش با خطا مواجه شد");
    } finally {
      setSubmitting(false);
    }
  };

  const unrepliedOpenCount = myReports.filter(
    (report) =>
      (report.status === "pending" || report.status === "in_progress") && !report.adminNote
  ).length;
  const withReplyCount = myReports.filter((report) => Boolean(report.adminNote)).length;
  const localUnreadCount = myReports.filter((report) => report.hasUnreadReply).length;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="fixed bottom-5 left-5 z-[80] gap-2 shadow-md lg:left-6"
        data-audit-label="گزارش مشکل"
        onClick={() => handleOpenChange(true)}
      >
        <span className="relative">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          {unreadCount > 0 && (
            <span
              className="absolute -top-1 -start-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-background"
              aria-label="پاسخ خوانده‌نشده"
            />
          )}
        </span>
        گزارش مشکل
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              گزارش مشکل
              {localUnreadCount > 0 && (
                <span className="inline-block h-2 w-2 rounded-full bg-red-500" aria-hidden />
              )}
            </DialogTitle>
            <DialogDescription>
              مشکل جدید ثبت کنید یا گزارش‌های قبلی و پاسخ ادمین را ببینید.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="new">گزارش جدید</TabsTrigger>
              <TabsTrigger value="history" className="gap-1.5">
                گزارش‌های من
                {localUnreadCount > 0 ? (
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                  </span>
                ) : myReports.length > 0 ? (
                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                    {myReports.length}
                  </Badge>
                ) : null}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="new" className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">نوع مشکل</label>
                <Select
                  value={category}
                  onValueChange={(value) => setCategory(value as ProblemReportCategory)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="انتخاب نوع مشکل" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((key) => (
                      <SelectItem key={key} value={key}>
                        {PROBLEM_REPORT_CATEGORY_LABELS[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">عنوان کوتاه</label>
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="مثلاً: دکمه ذخیره کار نمی‌کند"
                  maxLength={160}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">توضیح مشکل</label>
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="چه کاری می‌خواستید انجام دهید و چه اتفاقی افتاد؟"
                  className="min-h-[120px]"
                  maxLength={4000}
                />
              </div>

              <ProblemReportAttachmentsField
                value={attachments}
                onChange={setAttachments}
                disabled={submitting}
              />

              <p className="text-xs text-muted-foreground" dir="ltr">
                صفحه فعلی: {pathname}
                {searchParams.toString() ? `?${searchParams.toString()}` : ""}
              </p>

              <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={submitting}
                >
                  انصراف
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  data-audit-label="ارسال گزارش مشکل"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      در حال ارسال…
                    </>
                  ) : (
                    "ارسال گزارش"
                  )}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="history" className="space-y-3 py-2">
              {(unrepliedOpenCount > 0 || withReplyCount > 0) && (
                <p className="text-xs text-muted-foreground">
                  {withReplyCount > 0 ? `${withReplyCount} گزارش پاسخ ادمین دارد.` : null}
                  {unrepliedOpenCount > 0
                    ? ` ${unrepliedOpenCount} گزارش هنوز در انتظار پاسخ است.`
                    : null}
                </p>
              )}

              {historyLoading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  در حال بارگذاری…
                </div>
              ) : myReports.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  هنوز گزارشی ثبت نکرده‌اید.
                </p>
              ) : (
                <div className="space-y-3 max-h-[55vh] overflow-y-auto pe-1">
                  {myReports.map((report) => (
                    <div
                      key={report.id}
                      className={`rounded-lg border p-3 space-y-2 ${
                        report.hasUnreadReply ? "border-red-400/60 bg-red-500/[0.03]" : ""
                      }`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={STATUS_BADGE[report.status]}>
                          {PROBLEM_REPORT_STATUS_LABELS[report.status]}
                        </Badge>
                        <Badge variant="outline">
                          {PROBLEM_REPORT_CATEGORY_LABELS[report.category]}
                        </Badge>
                        {report.hasUnreadReply && (
                          <Badge variant="destructive" className="gap-1">
                            پاسخ جدید
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground ms-auto">
                          {formatPersianDateTime(report.createdAt)}
                        </span>
                      </div>
                      <h3 className="font-medium text-sm">{report.title}</h3>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">
                        {report.description}
                      </p>
                      <ProblemReportAttachmentsView attachments={report.attachments} />
                      {report.adminNote ? (
                        <div className="rounded-md bg-primary/5 border border-primary/15 px-3 py-2 text-sm space-y-1">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                            <MessageSquareText className="h-3.5 w-3.5" />
                            پاسخ ادمین
                          </div>
                          <p className="whitespace-pre-wrap">{report.adminNote}</p>
                        </div>
                      ) : report.status === "pending" || report.status === "in_progress" ? (
                        <p className="text-xs text-muted-foreground">هنوز پاسخی ثبت نشده است.</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
