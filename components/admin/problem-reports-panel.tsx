"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { AlertTriangle, Loader2, MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  listMyProblemReportsAction,
  markMyProblemReportsSeenAction,
  submitProblemReportAction,
  type MyProblemReport,
} from "@/lib/actions/problem-report-actions";
import {
  PROBLEM_REPORT_CATEGORY_LABELS,
  PROBLEM_REPORT_STATUS_LABELS,
  type ProblemReportCategory,
  type ProblemReportStatus,
} from "@/lib/audit/problem-types";
import { formatPersianDateTime } from "@/lib/utils";

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

type PanelTab = "new" | "history";

interface ProblemReportsPanelProps {
  /** Prefer opening history when the user arrives with unread replies. */
  initialTab?: PanelTab;
  onUnreadChange?: (count: number) => void;
}

export function ProblemReportsPanel({
  initialTab = "new",
  onUnreadChange,
}: ProblemReportsPanelProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<PanelTab>(initialTab);
  const [category, setCategory] = useState<ProblemReportCategory>("other");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [myReports, setMyReports] = useState<MyProblemReport[]>([]);

  const unreadCount = myReports.filter((report) => report.hasUnreadReply).length;
  const unrepliedOpenCount = myReports.filter(
    (report) =>
      (report.status === "pending" || report.status === "in_progress") && !report.adminNote
  ).length;
  const withReplyCount = myReports.filter((report) => Boolean(report.adminNote)).length;

  const notifyUnread = (reports: MyProblemReport[]) => {
    onUnreadChange?.(reports.filter((report) => report.hasUnreadReply).length);
  };

  const loadHistory = async (options?: { markSeen?: boolean }) => {
    setHistoryLoading(true);
    try {
      const result = await listMyProblemReportsAction();
      if (!result.success) {
        toast.error(result.error ?? "بارگذاری گزارش‌ها ناموفق بود");
        setMyReports([]);
        onUnreadChange?.(0);
        return;
      }

      const reports = result.reports ?? [];
      const hasUnread = reports.some((report) => report.hasUnreadReply);

      setMyReports(reports);

      if (options?.markSeen && hasUnread) {
        const seenResult = await markMyProblemReportsSeenAction();
        // Clear nav red-dot, but keep local "پاسخ جدید" badges for this visit.
        if (seenResult.success) {
          onUnreadChange?.(0);
        } else {
          notifyUnread(reports);
        }
      } else {
        notifyUnread(reports);
      }
    } catch {
      toast.error("بارگذاری گزارش‌ها با خطا مواجه شد");
      setMyReports([]);
      onUnreadChange?.(0);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    void loadHistory({ markSeen: initialTab === "history" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount / initialTab
  }, [initialTab]);

  useEffect(() => {
    if (initialTab === "history") setTab("history");
  }, [initialTab]);

  const handleTabChange = (value: string) => {
    const next = value as PanelTab;
    setTab(next);
    if (next === "history") {
      void loadHistory({ markSeen: true });
    }
  };

  const resetForm = () => {
    setCategory("other");
    setTitle("");
    setDescription("");
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
      });

      if (!result.success) {
        toast.error(result.error ?? "ارسال گزارش ناموفق بود");
        return;
      }

      toast.success("گزارش مشکل ثبت شد. ادمین رسیدگی می‌کند.");
      resetForm();
      setTab("history");
      await loadHistory({ markSeen: true });
    } catch {
      toast.error("ارسال گزارش با خطا مواجه شد");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-amber-500" />
          گزارش مشکل
          {unreadCount > 0 && (
            <span
              className="inline-block h-2.5 w-2.5 rounded-full bg-red-500"
              title="پاسخ خوانده‌نشده"
              aria-label="پاسخ خوانده‌نشده"
            />
          )}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          مشکل جدید ثبت کنید یا گزارش‌های قبلی و پاسخ ادمین را ببینید.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">گزارش‌های شما</CardTitle>
          <CardDescription>
            وضعیت هر گزارش و پاسخ ادمین در همین صفحه نمایش داده می‌شود.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="new">گزارش جدید</TabsTrigger>
              <TabsTrigger value="history" className="gap-1.5">
                گزارش‌های من
                {unreadCount > 0 ? (
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

            <TabsContent value="new" className="space-y-4 py-4">
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
                  className="min-h-[140px]"
                  maxLength={4000}
                />
              </div>

              <p className="text-xs text-muted-foreground" dir="ltr">
                صفحه فعلی: {pathname}
                {searchParams.toString() ? `?${searchParams.toString()}` : ""}
              </p>

              <div className="flex justify-end">
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

            <TabsContent value="history" className="space-y-3 py-4">
              {(unrepliedOpenCount > 0 || withReplyCount > 0) && (
                <p className="text-xs text-muted-foreground">
                  {withReplyCount > 0 ? `${withReplyCount} گزارش پاسخ ادمین دارد.` : null}
                  {unrepliedOpenCount > 0
                    ? ` ${unrepliedOpenCount} گزارش هنوز در انتظار پاسخ است.`
                    : null}
                </p>
              )}

              {historyLoading ? (
                <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  در حال بارگذاری…
                </div>
              ) : myReports.length === 0 ? (
                <p className="text-sm text-muted-foreground py-12 text-center">
                  هنوز گزارشی ثبت نکرده‌اید.
                </p>
              ) : (
                <div className="space-y-3">
                  {myReports.map((report) => (
                    <div
                      key={report.id}
                      className={`rounded-lg border p-4 space-y-2 ${
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
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-white" />
                            پاسخ جدید
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground ms-auto">
                          {formatPersianDateTime(report.createdAt)}
                        </span>
                      </div>
                      <h3 className="font-medium text-sm">{report.title}</h3>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {report.description}
                      </p>
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
        </CardContent>
      </Card>
    </div>
  );
}
