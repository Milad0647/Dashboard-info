"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  ArrowRight,
  Download,
  ExternalLink,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { ContentScoreControl } from "@/components/admin/content-score-control";
import { SendContentMessageButton } from "@/components/admin/send-content-message-button";
import { UserProfileNotesPanel } from "@/components/admin/user-profile-notes-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  listAllContentMessagesAction,
  type AdminContentMessageListItem,
} from "@/lib/actions/content-message-actions";
import {
  approveContentAction,
  rejectContentForRevisionAction,
} from "@/lib/actions/content-review-actions";
import { getProvinceRankBadge, type UserLeaderboardEntry } from "@/lib/city-leaderboard";
import {
  COMPANY_SUPERVISION_TYPE_FILTERS,
  reviewStatusLabel,
  type CompanySupervisionContentType,
  type CompanySupervisionItem,
} from "@/lib/company-supervision";
import { downloadCompanyPerformanceExcel } from "@/lib/services/performance-excel-export";
import { formatPersianDateTime, formatPersianNumber } from "@/lib/utils";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const METRIC_COLUMNS: { key: keyof UserLeaderboardEntry; label: string }[] = [
  { key: "billboards", label: "تبلیغات محیطی" },
  { key: "totalAreaSqm", label: "متراژ" },
  { key: "posters", label: "پوستر" },
  { key: "videos", label: "ویدیو" },
  { key: "socialPosts", label: "شبکه اجتماعی" },
  { key: "sitePublications", label: "انتشار سایت" },
  { key: "activities", label: "اقدام" },
  { key: "files", label: "فایل" },
];

function ContentItemCard({
  item,
  campaignId,
  canScore,
  canSendMessage,
  canManageReviews,
  reviewPending,
  onApprove,
  onReject,
}: {
  item: CompanySupervisionItem;
  campaignId: string;
  canScore: boolean;
  canSendMessage: boolean;
  canManageReviews: boolean;
  reviewPending: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const statusLabel = reviewStatusLabel(item.reviewStatus);

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border bg-card">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {item.thumbnailUrl ? (
          <Image
            src={item.thumbnailUrl}
            alt={item.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        ) : (
          <MediaPlaceholder kind="poster" className="h-full w-full" />
        )}
        <div className="absolute top-2 right-2 flex flex-wrap justify-end gap-1">
          <Badge variant="overlay" className="text-[10px]">
            {item.typeLabel}
          </Badge>
          {item.isToday && (
            <Badge variant="overlay" className="text-[10px]">
              امروز
            </Badge>
          )}
          {statusLabel && (
            <Badge variant="overlay" className="text-[10px]">
              {statusLabel}
            </Badge>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="line-clamp-2 font-medium leading-snug">{item.title}</p>
        <p className="text-[11px] text-muted-foreground">
          {item.createdAt ? formatPersianDateTime(item.createdAt) : "بدون تاریخ"}
        </p>
        {item.rejectionReason && (
          <p className="line-clamp-3 rounded-lg bg-muted/60 p-2 text-xs text-muted-foreground">
            دلیل برگشت: {item.rejectionReason}
          </p>
        )}
      </div>

      {canScore && (
        <div className="border-t px-3 py-2">
          <ContentScoreControl
            campaignId={campaignId}
            contentType={item.contentType}
            contentId={item.contentId}
            score={item.score}
            autoScore={item.autoScore}
            manualScore={item.manualScore}
            canScore={canScore}
            compact
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t p-3">
        {canSendMessage && (
          <SendContentMessageButton
            target={{
              campaignId,
              contentType: item.contentType,
              contentId: item.contentId,
              contentTitle: item.title,
              ownerName: undefined,
            }}
            compact
          />
        )}
        {canManageReviews && item.isReviewable && (
          <>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="flex-1"
              disabled={reviewPending}
              onClick={onApprove}
            >
              تایید محتوا
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="flex-1"
              disabled={reviewPending}
              onClick={onReject}
            >
              رد با دلیل
            </Button>
          </>
        )}
        <Button type="button" variant="ghost" size="icon" className="shrink-0" asChild>
          <Link href={item.adminPath} title="ویرایش در پنل">
            <ExternalLink className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </article>
  );
}

function MessageList({ messages }: { messages: AdminContentMessageListItem[] }) {
  if (messages.length === 0) {
    return (
      <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
        پیامی برای این شرکت ثبت نشده است.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {messages.map((message) => {
        const followUpLabel =
          message.followUpStatus === "awaiting_user"
            ? "در انتظار پاسخ کاربر"
            : message.followUpStatus === "user_replied"
              ? "کاربر پاسخ داده"
              : message.followUpStatus === "resolved"
                ? "بسته‌شده"
                : "باز";
        return (
          <article key={message.id} className="rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px]">
                    {message.contentTypeLabel}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    {followUpLabel}
                  </Badge>
                </div>
                <h3 className="font-medium leading-snug">
                  {message.contentTitle || "بدون عنوان"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  از {message.senderName ?? "مدیر / کارفرما"} ·{" "}
                  {formatPersianDateTime(message.createdAt)}
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" className="gap-1.5" asChild>
                <Link href={message.adminPath}>
                  <ExternalLink className="h-3.5 w-3.5" />
                  مشاهده کارت
                </Link>
              </Button>
            </div>
            <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed">
              {message.body}
            </p>
            {message.replies && message.replies.length > 0 && (
              <div className="mt-3 space-y-2 rounded-lg border bg-muted/40 p-3">
                {message.replies.map((reply) => (
                  <div key={reply.id} className="space-y-1 text-sm">
                    <p className="text-xs text-muted-foreground">
                      پاسخ · {formatPersianDateTime(reply.createdAt)}
                    </p>
                    <p className="whitespace-pre-wrap">{reply.body}</p>
                  </div>
                ))}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

export function CompanySupervisionAdmin({
  campaignId,
  campaignTitle,
  campaignSlug,
  entry,
  items,
  canScore,
  canManageReviews,
  canSendMessage,
}: {
  campaignId: string;
  campaignTitle: string;
  campaignSlug: string;
  entry: UserLeaderboardEntry;
  items: CompanySupervisionItem[];
  canScore: boolean;
  canManageReviews: boolean;
  canSendMessage: boolean;
}) {
  const router = useRouter();
  const [typeFilter, setTypeFilter] = useState<CompanySupervisionContentType | "all">("all");
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [rejectingItem, setRejectingItem] = useState<CompanySupervisionItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [messages, setMessages] = useState<AdminContentMessageListItem[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const canOpenNotes = UUID_RE.test(entry.userKey);

  const backHref = `/admin/performance?campaign=${encodeURIComponent(campaignId)}`;

  const todayItems = useMemo(() => items.filter((item) => item.isToday), [items]);
  const returnedItems = useMemo(
    () =>
      items.filter(
        (item) => item.reviewStatus === "needs_revision" || item.reviewStatus === "resubmitted"
      ),
    [items]
  );

  const filteredContent = useMemo(() => {
    if (typeFilter === "all") return items;
    return items.filter((item) => item.contentType === typeFilter);
  }, [items, typeFilter]);

  const todayByType = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of todayItems) {
      map.set(item.typeLabel, (map.get(item.typeLabel) ?? 0) + 1);
    }
    return [...map.entries()];
  }, [todayItems]);

  const loadMessages = useCallback(() => {
    if (!canOpenNotes) {
      setMessages([]);
      return;
    }
    setMessagesLoading(true);
    void listAllContentMessagesAction({
      recipientUserId: entry.userKey,
      limit: 200,
    }).then((result) => {
      if (!result.success) {
        toast.error(result.error ?? "بارگذاری پیام‌ها ناموفق بود");
        setMessages([]);
      } else {
        setMessages(result.messages ?? []);
      }
      setMessagesLoading(false);
    });
  }, [canOpenNotes, entry.userKey]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const runApprove = (item: CompanySupervisionItem) => {
    setPendingKey(item.key);
    startTransition(async () => {
      const result = await approveContentAction({
        campaignId,
        contentType: item.contentType,
        contentId: item.contentId,
      });
      setPendingKey(null);
      if (!result.success) {
        toast.error(result.error ?? "تایید محتوا ناموفق بود");
        return;
      }
      toast.success("محتوا تایید شد");
      router.refresh();
    });
  };

  const runReject = () => {
    if (!rejectingItem) return;
    const reason = rejectionReason.trim();
    if (reason.length < 3) {
      toast.error("دلیل رد حداقل ۳ کاراکتر باشد");
      return;
    }
    const item = rejectingItem;
    setPendingKey(item.key);
    startTransition(async () => {
      const result = await rejectContentForRevisionAction({
        campaignId,
        contentType: item.contentType,
        contentId: item.contentId,
        rejectionReason: reason,
      });
      setPendingKey(null);
      if (!result.success) {
        toast.error(result.error ?? "رد محتوا ناموفق بود");
        return;
      }
      toast.success("محتوا برای ویرایش برگشت داده شد");
      setRejectingItem(null);
      setRejectionReason("");
      router.refresh();
      loadMessages();
    });
  };

  const handleExport = () => {
    try {
      downloadCompanyPerformanceExcel({
        entry,
        items,
        campaignTitle,
        campaignSlug,
      });
      toast.success("گزارش اکسل شرکت دانلود شد");
    } catch {
      toast.error("خطا در ساخت فایل اکسل");
    }
  };

  const renderGrid = (list: CompanySupervisionItem[]) => {
    if (list.length === 0) {
      return (
        <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
          موردی یافت نشد.
        </div>
      );
    }
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((item) => (
          <ContentItemCard
            key={item.key}
            item={item}
            campaignId={campaignId}
            canScore={canScore}
            canSendMessage={canSendMessage}
            canManageReviews={canManageReviews}
            reviewPending={isPending && pendingKey === item.key}
            onApprove={() => runApprove(item)}
            onReject={() => {
              setRejectingItem(item);
              setRejectionReason("");
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <Button type="button" variant="ghost" size="sm" className="gap-1.5 px-0" asChild>
            <Link href={backHref}>
              <ArrowRight className="h-4 w-4" />
              بازگشت به مشاهده عملکرد
            </Link>
          </Button>
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">نظارت شرکت — {entry.userName}</h1>
            <p className="text-sm text-muted-foreground">
              همه اطلاعات و عملیات نظارتی این شرکت در کمپین «{campaignTitle}»
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">رتبه {getProvinceRankBadge(entry.rank)}</Badge>
            <Badge variant="outline">{entry.province}</Badge>
            <Badge variant="outline">
              {formatPersianNumber(entry.totalUploads)} محتوا
            </Badge>
            <Badge variant="outline">
              {formatPersianNumber(entry.score)} امتیاز فعالیت
            </Badge>
            <Badge variant="outline">
              {formatPersianNumber(entry.ratingScore)} امتیاز محتوا
            </Badge>
            {(entry.pendingScore ?? 0) > 0 && (
              <Badge variant="outline" className="text-amber-700 dark:text-amber-400">
                {formatPersianNumber(entry.pendingScore)} در انتظار
              </Badge>
            )}
            {entry.todayUploads > 0 && (
              <Badge className="bg-success/15 text-success hover:bg-success/20">
                +{formatPersianNumber(entry.todayUploads)} امروز
              </Badge>
            )}
            {returnedItems.length > 0 && (
              <Badge variant="destructive">
                {formatPersianNumber(returnedItems.length)} برگشتی
              </Badge>
            )}
          </div>
        </div>
        <Button type="button" onClick={handleExport} className="shrink-0 gap-2">
          <Download className="h-4 w-4" />
          خروجی اکسل شرکت
        </Button>
      </div>

      <Tabs defaultValue="summary" className="space-y-4">
        <TabsList className="h-auto w-full justify-start">
          <TabsTrigger value="summary">خلاصه</TabsTrigger>
          <TabsTrigger value="today">
            امروز ({formatPersianNumber(todayItems.length)})
          </TabsTrigger>
          <TabsTrigger value="content">
            محتوا ({formatPersianNumber(items.length)})
          </TabsTrigger>
          <TabsTrigger value="returned">
            برگشتی ({formatPersianNumber(returnedItems.length)})
          </TabsTrigger>
          <TabsTrigger value="messages">
            پیام‌ها ({formatPersianNumber(messages.length)})
          </TabsTrigger>
          <TabsTrigger value="notes">یادداشت‌ها</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">امتیاز بخش‌ها</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  { label: "امتیاز اکران محیطی", value: entry.billboardScore },
                  { label: "امتیاز تولید پوستر", value: entry.posterScore },
                  { label: "امتیاز تولید ویدئو", value: entry.videoScore },
                  { label: "امتیاز نشر و بازنشر", value: entry.socialScore },
                  {
                    label: "امتیاز نهایی شرکت",
                    value:
                      entry.billboardScore +
                      entry.posterScore +
                      entry.videoScore +
                      entry.socialScore,
                  },
                  { label: "رتبه کشوری", value: entry.rank },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-lg border bg-muted/30 px-3 py-2.5"
                  >
                    <p className="text-[11px] text-muted-foreground">{item.label}</p>
                    <p className="text-sm font-semibold tabular-nums">
                      {formatPersianNumber(item.value)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">آمار عددی این کمپین</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {METRIC_COLUMNS.map((column) => (
                  <div
                    key={column.key}
                    className="rounded-lg border bg-muted/30 px-3 py-2.5"
                  >
                    <p className="text-[11px] text-muted-foreground">{column.label}</p>
                    <p className="text-sm font-semibold tabular-nums">
                      {formatPersianNumber(Number(entry[column.key] ?? 0))}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">آپلود امروز</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                امروز {formatPersianNumber(todayItems.length)} محتوا آپلود شده است.
              </p>
              {todayByType.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {todayByType.map(([label, count]) => (
                    <Badge key={label} variant="outline">
                      {label}: {formatPersianNumber(count)}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">آپلودی برای امروز ثبت نشده.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="today" className="space-y-4">
          {renderGrid(todayItems)}
        </TabsContent>

        <TabsContent value="content" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={typeFilter}
              onValueChange={(value) =>
                setTypeFilter(value as CompanySupervisionContentType | "all")
              }
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="نوع محتوا" />
              </SelectTrigger>
              <SelectContent>
                {COMPANY_SUPERVISION_TYPE_FILTERS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {formatPersianNumber(filteredContent.length)} مورد
            </p>
          </div>
          {renderGrid(filteredContent)}
        </TabsContent>

        <TabsContent value="returned" className="space-y-4">
          {returnedItems.length === 0 ? (
            <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
              محتوای برگشتی برای این شرکت نیست.
            </div>
          ) : (
            <div className="space-y-3">
              {returnedItems.map((item) => (
                <article key={item.key} className="rounded-xl border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant={
                            item.reviewStatus === "resubmitted" ? "default" : "destructive"
                          }
                          className="text-[10px]"
                        >
                          {item.reviewStatus === "resubmitted"
                            ? "ارسال‌مجدد (ویرایش کرده)"
                            : "برگشت برای ویرایش (هنوز ویرایش نشده)"}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {item.typeLabel}
                        </Badge>
                      </div>
                      <h3 className="font-medium leading-snug">{item.title}</h3>
                      {item.reviewUpdatedAt && (
                        <p className="text-xs text-muted-foreground">
                          آخرین بروزرسانی: {formatPersianDateTime(item.reviewUpdatedAt)}
                        </p>
                      )}
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="gap-1.5" asChild>
                      <Link href={item.adminPath}>
                        <ExternalLink className="h-3.5 w-3.5" />
                        ویرایش محتوا
                      </Link>
                    </Button>
                  </div>
                  {item.rejectionReason && (
                    <p className="mt-3 whitespace-pre-wrap rounded-lg bg-muted/60 p-3 text-sm">
                      دلیل برگشت: {item.rejectionReason}
                    </p>
                  )}
                  {canManageReviews && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={isPending && pendingKey === item.key}
                        onClick={() => runApprove(item)}
                      >
                        تایید نهایی
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={isPending && pendingKey === item.key}
                        onClick={() => {
                          setRejectingItem(item);
                          setRejectionReason("");
                        }}
                      >
                        رد مجدد
                      </Button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="messages" className="space-y-4">
          {!canOpenNotes ? (
            <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
              برای این ردیف شناسه کاربر ثبت نشده و پیام‌ها قابل بارگذاری نیستند.
            </div>
          ) : messagesLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              در حال بارگذاری پیام‌ها...
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MessageSquare className="h-4 w-4" />
                پیام‌های ارسال‌شده به این شرکت و پاسخ‌ها
              </div>
              <MessageList messages={messages} />
            </>
          )}
        </TabsContent>

        <TabsContent value="notes">
          {canOpenNotes ? (
            <UserProfileNotesPanel
              subjectUserId={entry.userKey}
              subjectName={entry.userName}
            />
          ) : (
            <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
              برای این ردیف شناسه کاربر ثبت نشده و یادداشت ممکن نیست.
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog
        open={Boolean(rejectingItem)}
        onOpenChange={(open) => {
          if (!open) {
            setRejectingItem(null);
            setRejectionReason("");
          }
        }}
      >
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>رد محتوا با دلیل</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {rejectingItem?.title} — {rejectingItem?.typeLabel}
            </p>
            <div className="space-y-2">
              <Label htmlFor="company-reject-reason">دلیل رد</Label>
              <Textarea
                id="company-reject-reason"
                value={rejectionReason}
                onChange={(event) => setRejectionReason(event.target.value)}
                rows={4}
                placeholder="دلیل برگشت برای ویرایش را بنویسید..."
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setRejectingItem(null);
                setRejectionReason("");
              }}
            >
              انصراف
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={runReject}
            >
              ثبت رد
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
