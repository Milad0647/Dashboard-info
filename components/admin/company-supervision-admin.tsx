"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  BadgeCheck,
  Download,
  ExternalLink,
  FileText,
  Globe,
  History,
  ImageIcon,
  LayoutGrid,
  Layers,
  Loader2,
  Megaphone,
  MessageSquare,
  Share2,
  TriangleAlert,
  Undo2,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { CompanyPresenceTimeline } from "@/components/admin/company-presence-timeline";
import { EmptyFieldFilterSelect } from "@/components/admin/empty-field-filter-select";
import { EmptyFieldsBadges } from "@/components/admin/empty-fields-badges";
import { ContentMixChart } from "@/components/charts/content-mix-chart";
import { UploadActivityChart } from "@/components/charts/upload-activity-chart";
import { ContentScoreControl } from "@/components/admin/content-score-control";
import { BulkContentReviewActions, BulkTopicEditPanel } from "@/components/admin/bulk-content-review-bar";
import { SendContentMessageButton } from "@/components/admin/send-content-message-button";
import { ContentMessageChatThread } from "@/components/admin/content-message-chat-thread";
import {
  BulkItemShell,
  useSectionBulkEdit,
} from "@/components/admin/section-bulk-edit";
import { UserProfileNotesPanel } from "@/components/admin/user-profile-notes-panel";
import { KPICard } from "@/components/public/kpi-card";
import { OwnerLocationFilterBar } from "@/components/public/owner-location-filter-bar";
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
import { MediaThumbnail } from "@/components/ui/media-thumbnail";
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
  listContentMessagesForCardAction,
  type AdminContentMessageListItem,
  type ContentMessageListItem,
} from "@/lib/actions/content-message-actions";
import {
  getCompanySupervisionDayActivityAction,
  type CompanyDayActivityEvent,
  type CompanyDayActivityResult,
} from "@/lib/actions/audit-actions";
import {
  approveContentAction,
  bulkApproveContentAction,
  bulkRejectContentForRevisionAction,
  rejectContentForRevisionAction,
} from "@/lib/actions/content-review-actions";
import { bulkUpdatePlanLabelsAction } from "@/lib/actions/bulk-update-actions";
import { getProvinceRankBadge, type UserLeaderboardEntry } from "@/lib/city-leaderboard";
import type { ContentTopic } from "@/lib/content-topics";
import {
  referralReasonForEmptyItems,
  type EmptyFieldFilter,
} from "@/lib/empty-content-fields";
import {
  COMPANY_CATEGORY_CARD_LIMIT,
  COMPANY_SUPERVISION_REVIEW_FILTERS,
  COMPANY_SUPERVISION_TYPE_FILTERS,
  buildCompanyContentMixFromCounts,
  buildCompanyUploadActivityStats,
  collectCompanyOwnerLocations,
  collectTodayReturnedItems,
  collectTodaySupervisionItems,
  countTodayByContentType,
  filterCompanySupervisionItems,
  groupCompanySupervisionItems,
  isCompanyContentFilterActive,
  limitCompanyCategoryItems,
  reviewStatusLabel,
  summarizeSupervisionItems,
  type CompanyExcelSource,
  type CompanySupervisionContentType,
  type CompanySupervisionItem,
  type CompanySupervisionReviewFilter,
} from "@/lib/company-supervision";
import { ContentScoreProvider } from "@/lib/context/content-score-context";
import { threadFromRoot, threadFromRoots } from "@/lib/content-messages/thread";
import { resolveErrorInfo } from "@/lib/error-solutions";
import {
  OwnerLocationFilterProvider,
  useOwnerLocationFilter,
} from "@/lib/context/owner-location-filter-context";
import type { OwnerLocationFilter } from "@/lib/owner-location-filter";
import { downloadCompanyPerformanceExcel } from "@/lib/services/performance-excel-export";
import { getTehranCalendarDateIso, isTehranToday } from "@/lib/safe-dates";
import {
  formatPersianDateTime,
  formatPersianNumber,
  formatTehranClock,
} from "@/lib/utils";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const CONTENT_CARD_GRID_CLASS =
  "grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-9";

const TOPIC_BULK_CONTENT_TYPES = new Set<CompanySupervisionContentType>([
  "billboard",
  "poster",
  "video",
  "file",
  "social_post",
  "site_publication",
  "activity",
]);

function canSelectForBulk(item: CompanySupervisionItem): boolean {
  return TOPIC_BULK_CONTENT_TYPES.has(item.contentType);
}

function ContentItemCard({
  item,
  campaignId,
  canScore,
  canSendMessage,
  canManageReviews,
  reviewPending,
  onOpen,
  onApprove,
  onReject,
}: {
  item: CompanySupervisionItem;
  campaignId: string;
  canScore: boolean;
  canSendMessage: boolean;
  canManageReviews: boolean;
  reviewPending: boolean;
  onOpen: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const statusLabel = reviewStatusLabel(item.reviewStatus);

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border bg-card text-right" dir="rtl">
      <button
        type="button"
        className="relative aspect-[4/3] w-full overflow-hidden bg-muted text-start"
        onClick={onOpen}
      >
        {item.thumbnailUrl ? (
          <MediaThumbnail
            src={item.thumbnailUrl}
            alt={item.title}
            kind={
              item.contentType === "video"
                ? "video"
                : item.contentType === "billboard"
                  ? "billboard"
                  : "poster"
            }
            sizes="(max-width: 768px) 100vw, 33vw"
            objectFit="cover"
          />
        ) : (
          <MediaPlaceholder
            kind={item.contentType === "billboard" ? "billboard" : "poster"}
            className="h-full w-full"
          />
        )}
        <div className="absolute top-2 end-2 flex flex-wrap justify-end gap-1">
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
      </button>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <button type="button" className="text-right" onClick={onOpen}>
          <p className="line-clamp-2 font-medium leading-snug">{item.title}</p>
        </button>
        <p className="text-[11px] text-muted-foreground">
          {item.createdAt ? formatPersianDateTime(item.createdAt) : "بدون تاریخ"}
        </p>
        {item.rejectionReason && (
          <p className="line-clamp-3 rounded-lg bg-muted/60 p-2 text-xs text-muted-foreground">
            دلیل برگشت: {item.rejectionReason}
          </p>
        )}
        <EmptyFieldsBadges fields={item.emptyFields} />
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
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onOpen}>
          <History className="h-3.5 w-3.5" />
          مشاهده / تاریخچه
        </Button>
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
          item.reviewStatus === "approved" ? (
            <Badge
              variant="secondary"
              className="flex-1 justify-center gap-1.5 rounded-md bg-success/15 py-1.5 text-success hover:bg-success/15"
            >
              <BadgeCheck className="h-3.5 w-3.5 shrink-0" />
              تایید شده
            </Badge>
          ) : (
            <>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="flex-1"
                disabled={reviewPending}
                onClick={onApprove}
              >
                تایید
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="flex-1"
                disabled={reviewPending}
                onClick={onReject}
              >
                رد
              </Button>
            </>
          )
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

function MessageList({
  messages,
  emptyText = "پیامی برای این شرکت ثبت نشده است.",
}: {
  messages: AdminContentMessageListItem[];
  emptyText?: string;
}) {
  if (messages.length === 0) {
    return (
      <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="space-y-3" dir="rtl">
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
          <article key={message.id} className="rounded-xl border bg-card p-4 text-right" dir="rtl">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 space-y-1 text-right">
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
            <ContentMessageChatThread
              className="mt-3"
              items={threadFromRoot(message, "staff")}
            />
          </article>
        );
      })}
    </div>
  );
}

function ErrorEventCards({ events }: { events: CompanyDayActivityEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
        خطای ثبت‌شده‌ای برای امروز نیست.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {events.map((event) => {
        const info = event.label?.trim() ? resolveErrorInfo(event.label) : null;
        return (
          <article key={event.id} className="rounded-xl border bg-card p-4 text-right" dir="rtl">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="destructive" className="text-[10px]">
                {event.action === "auth.login_failed" ? "ورود ناموفق" : "خطای کاربر"}
              </Badge>
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatTehranClock(event.createdAt)}
              </span>
            </div>
            <p className="mt-2 text-sm font-medium leading-6">
              {info?.title ?? event.label?.trim() ?? "خطای ثبت‌شده"}
            </p>
            {info?.problem ? (
              <p className="mt-1 text-xs text-muted-foreground">{info.problem}</p>
            ) : event.path ? (
              <p className="mt-1 text-xs text-muted-foreground" dir="ltr">
                {event.path}
              </p>
            ) : null}
            {info?.solution ? (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                راهکار: {info.solution}
              </p>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}

function CardHistoryTimeline({ item }: { item: CompanySupervisionItem }) {
  const events: { label: string; at: string; detail?: string | null }[] = [];
  if (item.createdAt) {
    events.push({ label: "ثبت محتوا", at: item.createdAt });
  }
  if (item.rejectedAt) {
    events.push({
      label: "رد برای ویرایش",
      at: item.rejectedAt,
      detail: item.rejectionReason,
    });
  }
  if (item.resubmittedAt) {
    events.push({ label: "ارسال مجدد پس از ویرایش", at: item.resubmittedAt });
  }
  if (item.resolvedAt && item.reviewStatus === "approved") {
    events.push({ label: "تایید نهایی", at: item.resolvedAt });
  } else if (item.reviewUpdatedAt && item.reviewStatus === "approved") {
    events.push({ label: "تایید نهایی", at: item.reviewUpdatedAt });
  }

  events.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));

  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">هنوز تاریخچه‌ای برای این کارت ثبت نشده است.</p>
    );
  }

  return (
    <ol className="space-y-3 border-s-2 border-muted ps-4">
      {events.map((event, index) => (
        <li key={`${event.label}-${event.at}-${index}`} className="relative space-y-1">
          <span className="absolute -start-[1.35rem] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
          <p className="text-sm font-medium">{event.label}</p>
          <p className="text-xs text-muted-foreground">{formatPersianDateTime(event.at)}</p>
          {event.detail && (
            <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
              {event.detail}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

function SupervisionItemDialog({
  item,
  open,
  onOpenChange,
  campaignId,
  canScore,
  canSendMessage,
  canManageReviews,
  reviewPending,
  onApprove,
  onReject,
}: {
  item: CompanySupervisionItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campaignId: string;
  canScore: boolean;
  canSendMessage: boolean;
  canManageReviews: boolean;
  reviewPending: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const [messages, setMessages] = useState<ContentMessageListItem[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  useEffect(() => {
    if (!open || !item) {
      setMessages([]);
      return;
    }
    setLoadingMessages(true);
    void listContentMessagesForCardAction({
      contentType: item.contentType,
      contentId: item.contentId,
    }).then((result) => {
      if (result.success) {
        setMessages(result.messages ?? []);
      } else {
        setMessages([]);
      }
      setLoadingMessages(false);
    });
  }, [open, item]);

  if (!item) return null;

  const statusLabel = reviewStatusLabel(item.reviewStatus);
  const details = [
    { label: "نوع", value: item.typeLabel },
    {
      label: "تاریخ ثبت",
      value: item.createdAt ? formatPersianDateTime(item.createdAt) : "—",
    },
    { label: "استان", value: item.province || "—" },
    { label: "شهر", value: item.city || "—" },
    { label: "طرح", value: item.planLabel || "—" },
    ...(item.contentType === "billboard"
      ? [
          { label: "محل اکران", value: item.location || "—" },
          {
            label: "متراژ",
            value: item.areaSqm != null ? String(item.areaSqm) : "—",
          },
        ]
      : item.location
        ? [{ label: "موقعیت", value: item.location }]
        : []),
    { label: "وضعیت بازبینی", value: statusLabel || "بدون بازبینی" },
    { label: "منتشرشده", value: item.published ? "بله" : "خیر" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!flex max-h-[92vh] max-w-3xl flex-col gap-0 overflow-hidden p-0"
        dir="rtl"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <DialogHeader className="shrink-0 border-b px-6 py-4 pe-12 text-right">
          <DialogTitle className="break-words text-base">{item.title}</DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-4 text-right">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted">
            {item.imageUrl || item.thumbnailUrl ? (
              <MediaThumbnail
                src={item.imageUrl || item.thumbnailUrl}
                alt={item.title}
                kind={
                  item.contentType === "video"
                    ? "video"
                    : item.contentType === "billboard"
                      ? "billboard"
                      : "poster"
                }
                sizes="(max-width: 768px) 100vw, 42rem"
                objectFit="contain"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                تصویری ثبت نشده است
              </div>
            )}
          </div>

          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {item.description || "بدون توضیحات"}
          </p>
          <EmptyFieldsBadges fields={item.emptyFields} />

          <div className="grid gap-2 sm:grid-cols-2">
            {details.map((row) => (
              <div key={row.label} className="rounded-lg border bg-muted/30 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">{row.label}</p>
                <p className="text-sm font-medium">{row.value}</p>
              </div>
            ))}
          </div>

          {canScore && (
            <div className="rounded-xl border p-3">
              <ContentScoreControl
                campaignId={campaignId}
                contentType={item.contentType}
                contentId={item.contentId}
                score={item.score}
                autoScore={item.autoScore}
                manualScore={item.manualScore}
                canScore={canScore}
              />
            </div>
          )}

          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <History className="h-4 w-4" />
              تاریخچه کارت
            </h3>
            <CardHistoryTimeline item={item} />
          </section>

          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <MessageSquare className="h-4 w-4" />
              پیام‌های این کارت
            </h3>
            {loadingMessages ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                در حال بارگذاری...
              </div>
            ) : messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">پیامی روی این کارت نیست.</p>
            ) : (
              <ContentMessageChatThread items={threadFromRoots(messages, "staff")} />
            )}
          </section>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t px-6 py-3">
          {canSendMessage && (
            <SendContentMessageButton
              target={{
                campaignId,
                contentType: item.contentType,
                contentId: item.contentId,
                contentTitle: item.title,
              }}
            />
          )}
          {canManageReviews && item.isReviewable && (
            item.reviewStatus === "approved" ? (
              <Badge
                variant="secondary"
                className="gap-1.5 rounded-md bg-success/15 px-3 py-1.5 text-success hover:bg-success/15"
              >
                <BadgeCheck className="h-3.5 w-3.5 shrink-0" />
                تایید شده
              </Badge>
            ) : (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={reviewPending}
                  onClick={onApprove}
                >
                  تایید محتوا
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={reviewPending}
                  onClick={onReject}
                >
                  رد با دلیل
                </Button>
              </>
            )
          )}
          <Button type="button" variant="outline" className="gap-1.5" asChild>
            <Link href={item.adminPath}>
              <ExternalLink className="h-3.5 w-3.5" />
              ویرایش در پنل
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CompanySupervisionAdmin({
  campaignId,
  campaignTitle,
  campaignSlug,
  entry,
  items,
  excelSource,
  contentPlans = [],
  contentTopics = [],
  canScore,
  canManageReviews,
  canSendMessage,
  initialFilter,
  periodLabel,
  initialContentType = "all",
}: {
  campaignId: string;
  campaignTitle: string;
  campaignSlug: string;
  entry: UserLeaderboardEntry;
  items: CompanySupervisionItem[];
  excelSource: CompanyExcelSource;
  contentPlans?: string[];
  contentTopics?: ContentTopic[];
  canScore: boolean;
  canManageReviews: boolean;
  canSendMessage: boolean;
  initialFilter?: Partial<OwnerLocationFilter>;
  periodLabel?: string | null;
  initialContentType?: CompanySupervisionContentType | "all";
}) {
  const locations = useMemo(() => collectCompanyOwnerLocations(items), [items]);

  return (
    <ContentScoreProvider canScore={canScore} campaignId={campaignId}>
      <OwnerLocationFilterProvider
        locations={locations}
        plans={contentPlans}
        users={[]}
        initialFilter={initialFilter}
      >
        <CompanySupervisionAdminInner
          campaignId={campaignId}
          campaignTitle={campaignTitle}
          campaignSlug={campaignSlug}
          entry={entry}
          items={items}
          excelSource={excelSource}
          contentPlans={contentPlans}
          contentTopics={contentTopics}
          canScore={canScore}
          canManageReviews={canManageReviews}
          canSendMessage={canSendMessage}
          periodLabel={periodLabel}
          initialContentType={initialContentType}
        />
      </OwnerLocationFilterProvider>
    </ContentScoreProvider>
  );
}

function CompanySupervisionAdminInner({
  campaignId,
  campaignTitle,
  campaignSlug,
  entry,
  items,
  excelSource,
  contentPlans,
  contentTopics,
  canScore,
  canManageReviews,
  canSendMessage,
  periodLabel,
  initialContentType,
}: {
  campaignId: string;
  campaignTitle: string;
  campaignSlug: string;
  entry: UserLeaderboardEntry;
  items: CompanySupervisionItem[];
  excelSource: CompanyExcelSource;
  contentPlans: string[];
  contentTopics: ContentTopic[];
  canScore: boolean;
  canManageReviews: boolean;
  canSendMessage: boolean;
  periodLabel?: string | null;
  initialContentType: CompanySupervisionContentType | "all";
}) {
  const router = useRouter();
  const { filter } = useOwnerLocationFilter();
  const [typeFilter, setTypeFilter] = useState<CompanySupervisionContentType | "all">(
    initialContentType
  );
  const [reviewFilter, setReviewFilter] = useState<CompanySupervisionReviewFilter>("all");
  const [emptyField, setEmptyField] = useState<EmptyFieldFilter>("all");
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [rejectingItem, setRejectingItem] = useState<CompanySupervisionItem | null>(null);
  const [rejectingBulk, setRejectingBulk] = useState(false);
  const [approveBulkOpen, setApproveBulkOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState<CompanySupervisionItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [messages, setMessages] = useState<AdminContentMessageListItem[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("summary");
  const [todayDialogOpen, setTodayDialogOpen] = useState(false);
  const [dayActivity, setDayActivity] = useState<CompanyDayActivityResult | null>(null);
  const [dayActivityLoading, setDayActivityLoading] = useState(false);
  const canOpenNotes = UUID_RE.test(entry.userKey);

  const backHref = `/admin/performance?campaign=${encodeURIComponent(campaignId)}`;

  const returnedItems = useMemo(
    () =>
      items.filter(
        (item) => item.reviewStatus === "needs_revision" || item.reviewStatus === "resubmitted"
      ),
    [items]
  );

  const todayItems = useMemo(() => collectTodaySupervisionItems(items), [items]);
  const todayReturnedItems = useMemo(() => collectTodayReturnedItems(items), [items]);
  const todayMessages = useMemo(
    () => messages.filter((message) => isTehranToday(message.createdAt)),
    [messages]
  );

  const todayCounts = useMemo(() => countTodayByContentType(items), [items]);
  const scopedItems = useMemo(
    () =>
      filterCompanySupervisionItems(items, {
        campaignFilter: filter,
        contentType: "all",
        reviewFilter: "all",
        emptyField: "all",
      }),
    [items, filter]
  );
  const scopedSummary = useMemo(() => summarizeSupervisionItems(scopedItems), [scopedItems]);
  const contentMix = useMemo(
    () => buildCompanyContentMixFromCounts(scopedSummary.byType),
    [scopedSummary.byType]
  );
  const uploadStats = useMemo(
    () => buildCompanyUploadActivityStats(scopedItems),
    [scopedItems]
  );

  const showAllCategoryCards = useMemo(
    () =>
      isCompanyContentFilterActive(filter, {
        contentType: typeFilter,
        reviewFilter,
        emptyField,
      }),
    [filter, typeFilter, reviewFilter, emptyField]
  );

  const filteredContent = useMemo(
    () =>
      filterCompanySupervisionItems(items, {
        campaignFilter: filter,
        contentType: typeFilter,
        reviewFilter,
        emptyField,
      }),
    [items, filter, typeFilter, reviewFilter, emptyField]
  );

  const contentVisibleKeys = useMemo(() => {
    const groups = groupCompanySupervisionItems(filteredContent);
    const keys: string[] = [];
    for (const group of groups) {
      const { visible } = limitCompanyCategoryItems(group.items, showAllCategoryCards);
      for (const item of visible) {
        if (canSelectForBulk(item)) keys.push(item.key);
      }
    }
    return keys;
  }, [filteredContent, showAllCategoryCards]);

  const returnedVisibleKeys = useMemo(
    () => returnedItems.filter((item) => canSelectForBulk(item)).map((item) => item.key),
    [returnedItems]
  );

  const contentRetainKeys = useMemo(
    () => filteredContent.filter((item) => canSelectForBulk(item)).map((item) => item.key),
    [filteredContent]
  );
  const returnedRetainKeys = useMemo(
    () => returnedItems.filter((item) => canSelectForBulk(item)).map((item) => item.key),
    [returnedItems]
  );
  const bulkVisibleKeys = activeTab === "returned" ? returnedVisibleKeys : contentVisibleKeys;
  const bulkRetainKeys = activeTab === "returned" ? returnedRetainKeys : contentRetainKeys;
  const bulk = useSectionBulkEdit(
    canManageReviews ? bulkVisibleKeys : [],
    canManageReviews ? bulkRetainKeys : []
  );

  const selectedReviewItems = useMemo(() => {
    const map = new Map(items.map((item) => [item.key, item] as const));
    return [...bulk.selectedIds]
      .map((key) => map.get(key))
      .filter((item): item is CompanySupervisionItem => Boolean(item?.isReviewable));
  }, [items, bulk.selectedIds]);

  const selectedTopicItems = useMemo(() => {
    const map = new Map(items.map((item) => [item.key, item] as const));
    return [...bulk.selectedIds]
      .map((key) => map.get(key))
      .filter((item): item is CompanySupervisionItem => Boolean(item && canSelectForBulk(item)));
  }, [items, bulk.selectedIds]);

  const selectedApprovableItems = useMemo(
    () => selectedReviewItems.filter((item) => item.reviewStatus !== "approved"),
    [selectedReviewItems]
  );

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

  useEffect(() => {
    if (!canOpenNotes) {
      setDayActivity(null);
      return;
    }
    let cancelled = false;
    setDayActivityLoading(true);
    void getCompanySupervisionDayActivityAction(entry.userKey, getTehranCalendarDateIso()).then(
      (result) => {
        if (cancelled) return;
        if (!result.ok) {
          setDayActivity(null);
        } else {
          setDayActivity(result.data);
        }
        setDayActivityLoading(false);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [canOpenNotes, entry.userKey]);

  const openTodayItem = (item: CompanySupervisionItem) => {
    setTodayDialogOpen(false);
    setViewingItem(item);
  };

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
      setViewingItem(null);
      router.refresh();
    });
  };

  const runReject = () => {
    const reason = rejectionReason.trim();
    if (reason.length < 3) {
      toast.error("دلیل رد حداقل ۳ کاراکتر باشد");
      return;
    }

    if (rejectingBulk) {
      if (selectedReviewItems.length === 0) return;
      startTransition(async () => {
        const result = await bulkRejectContentForRevisionAction({
          campaignId,
          items: selectedReviewItems.map((item) => ({
            contentType: item.contentType,
            contentId: item.contentId,
          })),
          rejectionReason: reason,
        });
        if (!result.success) {
          toast.error(result.error ?? "رد گروهی ناموفق بود");
          return;
        }
        bulk.clearSelection();
        setRejectingBulk(false);
        setRejectionReason("");
        const extra =
          result.skipped > 0 || result.failed > 0
            ? ` — ${formatPersianNumber(result.skipped)} ردشده از قبل / ${formatPersianNumber(result.failed)} ناموفق`
            : "";
        toast.success(`${formatPersianNumber(result.processed)} محتوا برای ویرایش برگشت داده شد${extra}`);
        router.refresh();
        loadMessages();
      });
      return;
    }

    if (!rejectingItem) return;
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
      setViewingItem(null);
      router.refresh();
      loadMessages();
    });
  };

  const runBulkApprove = () => {
    if (selectedApprovableItems.length === 0) return;
    startTransition(async () => {
      const result = await bulkApproveContentAction({
        campaignId,
        items: selectedApprovableItems.map((item) => ({
          contentType: item.contentType,
          contentId: item.contentId,
        })),
      });
      setApproveBulkOpen(false);
      if (!result.success) {
        toast.error(result.error ?? "تایید گروهی ناموفق بود");
        return;
      }
      bulk.clearSelection();
      const extra =
        result.skipped > 0 || result.failed > 0
          ? ` — ${formatPersianNumber(result.skipped)} تاییدشده از قبل / ${formatPersianNumber(result.failed)} ناموفق`
          : "";
      toast.success(`${formatPersianNumber(result.processed)} محتوا تایید شد${extra}`);
      router.refresh();
    });
  };

  const runBulkTopic = (planLabels: string[]) => {
    if (selectedTopicItems.length === 0) {
      toast.error("حداقل یک مورد را انتخاب کنید");
      return;
    }
    startTransition(async () => {
      const result = await bulkUpdatePlanLabelsAction({
        campaignId,
        items: selectedTopicItems.map((item) => ({
          contentType: item.contentType,
          contentId: item.contentId,
        })),
        planLabels,
      });
      if (!result.success) {
        toast.error(result.error ?? "تغییر موضوع ناموفق بود");
        return;
      }
      toast.success(`موضوع ${formatPersianNumber(result.updated)} مورد به‌روزرسانی شد`);
      bulk.clearSelection();
      router.refresh();
    });
  };

  const handleExport = () => {
    try {
      downloadCompanyPerformanceExcel({
        entry,
        items,
        excelSource,
        campaignTitle,
        campaignSlug,
      });
      toast.success("گزارش اکسل شرکت دانلود شد");
    } catch {
      toast.error("خطا در ساخت فایل اکسل");
    }
  };

  const focusContentType = (type: CompanySupervisionContentType | "all" = "all") => {
    setTypeFilter(type);
    setActiveTab("content");
  };

  const kpiItems = (
    [
      {
        title: periodLabel ? `مجموع محتوا (${periodLabel})` : "مجموع محتوا",
        value: scopedSummary.total,
        icon: Layers,
        todayDelta: entry.todayUploads,
        type: "all" as const,
      },
      {
        title: "تبلیغات محیطی",
        value: scopedSummary.byType.billboard ?? 0,
        icon: LayoutGrid,
        todayDelta: todayCounts.billboard,
        type: "billboard" as const,
      },
      {
        title: "پوستر",
        value: scopedSummary.byType.poster ?? 0,
        icon: ImageIcon,
        todayDelta: todayCounts.poster,
        type: "poster" as const,
      },
      {
        title: "ویدیو",
        value: scopedSummary.byType.video ?? 0,
        icon: Video,
        todayDelta: todayCounts.video,
        type: "video" as const,
      },
      {
        title: "شبکه اجتماعی",
        value: scopedSummary.byType.social_post ?? 0,
        icon: Share2,
        todayDelta: todayCounts.social_post,
        type: "social_post" as const,
      },
      {
        title: "انتشار سایت",
        value: scopedSummary.byType.site_publication ?? 0,
        icon: Globe,
        todayDelta: todayCounts.site_publication,
        type: "site_publication" as const,
      },
      {
        title: "اقدام",
        value: scopedSummary.byType.activity ?? 0,
        icon: Megaphone,
        todayDelta: todayCounts.activity,
        type: "activity" as const,
      },
      {
        title: "فایل",
        value: scopedSummary.byType.file ?? 0,
        icon: FileText,
        todayDelta: todayCounts.file,
        type: "file" as const,
      },
    ] satisfies {
      title: string;
      value: number;
      icon: LucideIcon;
      todayDelta?: number;
      type: CompanySupervisionContentType | "all";
    }[]
  ).filter((item) => item.value > 0 || (item.todayDelta ?? 0) > 0);

  const extraKpiItems = [
    {
      title: "برگشتی امروز",
      value: todayReturnedItems.length,
      icon: Undo2,
      onClick: () => {
        if (todayReturnedItems.length > 0) setTodayDialogOpen(true);
        else setActiveTab("returned");
      },
    },
    {
      title: "خطاهای امروز",
      value: dayActivity?.errorCount ?? 0,
      icon: TriangleAlert,
      onClick: () => setTodayDialogOpen(true),
    },
    {
      title: "پیام‌های امروز",
      value: todayMessages.length,
      icon: MessageSquare,
      onClick: () => {
        if (todayMessages.length > 0) setTodayDialogOpen(true);
        else setActiveTab("messages");
      },
    },
  ] as const;

  const renderBulkToolbar = () => {
    if (!canManageReviews) return null;
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant={bulk.bulkMode ? "default" : "outline"}
            className="gap-1.5"
            onClick={() => bulk.setBulkMode(!bulk.bulkMode)}
          >
            <Layers className="h-4 w-4" />
            ویرایش گروهی
          </Button>
          {bulk.bulkMode && (
            <>
              <Button type="button" size="sm" variant="outline" onClick={bulk.toggleAllVisible}>
                {bulk.allVisibleSelected
                  ? "لغو انتخاب همه"
                  : `انتخاب همه (${formatPersianNumber(bulkVisibleKeys.length)})`}
              </Button>
              <BulkContentReviewActions
                selectedCount={bulk.selectedCount}
                approveCount={selectedApprovableItems.length}
                rejectCount={selectedReviewItems.length}
                pending={isPending}
                onApprove={() => setApproveBulkOpen(true)}
                onReject={() => {
                  setRejectingItem(null);
                  setRejectingBulk(true);
                  setRejectionReason(
                    referralReasonForEmptyItems(selectedReviewItems, emptyField)
                  );
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="gap-1.5"
                onClick={() => {
                  bulk.setBulkMode(false);
                  bulk.clearSelection();
                }}
              >
                <X className="h-4 w-4" />
                خروج
              </Button>
            </>
          )}
        </div>
        {bulk.bulkMode && (
          <BulkTopicEditPanel
            selectedCount={selectedTopicItems.length}
            contentTopics={contentTopics}
            contentPlans={contentPlans}
            pending={isPending}
            onApply={runBulkTopic}
          />
        )}
      </div>
    );
  };

  const renderGroupedGrid = (list: CompanySupervisionItem[], applyCategoryLimit: boolean) => {
    const groups = groupCompanySupervisionItems(list);
    if (groups.length === 0) {
      return (
        <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
          موردی یافت نشد.
        </div>
      );
    }
    const showAll = !applyCategoryLimit || showAllCategoryCards;
    return (
      <div className="space-y-8">
        {groups.map((group) => {
          const { visible, hiddenCount } = limitCompanyCategoryItems(group.items, showAll);
          return (
            <section key={group.type} className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-semibold">{group.label}</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {formatPersianNumber(group.items.length)}
                  </Badge>
                  {hiddenCount > 0 && (
                    <Badge variant="outline" className="text-[11px]">
                      نمایش {formatPersianNumber(COMPANY_CATEGORY_CARD_LIMIT)} از{" "}
                      {formatPersianNumber(group.items.length)} — با فیلتر همه را ببینید
                    </Badge>
                  )}
                </div>
              </div>
              <div className={CONTENT_CARD_GRID_CLASS}>
                {visible.map((item) => (
                  <BulkItemShell
                    key={item.key}
                    enabled={canManageReviews && bulk.bulkMode && canSelectForBulk(item)}
                    selected={bulk.isSelected(item.key)}
                    onToggle={() => bulk.toggle(item.key)}
                  >
                    <ContentItemCard
                      item={item}
                      campaignId={campaignId}
                      canScore={canScore}
                      canSendMessage={canSendMessage}
                      canManageReviews={canManageReviews}
                      reviewPending={isPending && pendingKey === item.key}
                      onOpen={() => setViewingItem(item)}
                      onApprove={() => runApprove(item)}
                      onReject={() => {
                        setRejectingBulk(false);
                        setRejectingItem(item);
                        setRejectionReason(referralReasonForEmptyItems([item], emptyField));
                      }}
                    />
                  </BulkItemShell>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    );
  };

  const renderSimpleGrid = (list: CompanySupervisionItem[], emptyText: string) => {
    if (list.length === 0) {
      return (
        <div className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
          {emptyText}
        </div>
      );
    }
    return (
      <div className={CONTENT_CARD_GRID_CLASS}>
        {list.map((item) => (
          <ContentItemCard
            key={item.key}
            item={item}
            campaignId={campaignId}
            canScore={canScore}
            canSendMessage={canSendMessage}
            canManageReviews={canManageReviews}
            reviewPending={isPending && pendingKey === item.key}
            onOpen={() => openTodayItem(item)}
            onApprove={() => runApprove(item)}
            onReject={() => {
              setTodayDialogOpen(false);
              setRejectingBulk(false);
              setRejectingItem(item);
              setRejectionReason(referralReasonForEmptyItems([item], emptyField));
            }}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
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
              گزارش زنده این شرکت در کمپین «{campaignTitle}» با امکان تایید، رد و تاریخچه کارت
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">
              رتبه {entry.rank > 0 ? getProvinceRankBadge(entry.rank) : "—"}
              {periodLabel ? ` ${periodLabel}` : ""}
            </Badge>
            <Badge variant="outline">{entry.province}</Badge>
            <Badge variant="outline">
              {formatPersianNumber(scopedSummary.total)} محتوا
              {periodLabel ? ` ${periodLabel}` : ""}
            </Badge>
            <Badge variant="outline">
              {formatPersianNumber(scopedSummary.activityScore)} امتیاز فعالیت
              {periodLabel ? ` ${periodLabel}` : ""}
            </Badge>
            <Badge variant="outline">
              {formatPersianNumber(scopedSummary.ratingScore)} امتیاز محتوا
              {periodLabel ? ` ${periodLabel}` : ""}
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

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          if (viewingItem) return;
          setActiveTab(value);
        }}
        className="space-y-4"
        dir="rtl"
      >
        <TabsList className="h-auto w-full justify-start">
          <TabsTrigger value="summary">خلاصه</TabsTrigger>
          <TabsTrigger value="content">
            محتوا ({formatPersianNumber(filteredContent.length)})
          </TabsTrigger>
          <TabsTrigger value="returned">
            برگشتی ({formatPersianNumber(returnedItems.length)})
          </TabsTrigger>
          <TabsTrigger value="messages">
            پیام‌ها ({formatPersianNumber(messages.length)})
          </TabsTrigger>
          <TabsTrigger value="notes">یادداشت‌ها</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-6">
          {(kpiItems.length > 0 || extraKpiItems.length > 0) && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {kpiItems.map((kpi) => (
                <KPICard
                  key={kpi.title}
                  title={kpi.title}
                  value={kpi.value}
                  icon={kpi.icon}
                  todayDelta={kpi.todayDelta}
                  onClick={() => focusContentType(kpi.type)}
                  onTodayDeltaClick={() => setTodayDialogOpen(true)}
                />
              ))}
              {extraKpiItems.map((kpi) => (
                <KPICard
                  key={kpi.title}
                  title={kpi.title}
                  value={kpi.value}
                  icon={kpi.icon}
                  onClick={kpi.onClick}
                />
              ))}
            </div>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                امتیاز بخش‌ها{periodLabel ? ` (${periodLabel})` : ""}
              </CardTitle>
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

          <div className="grid gap-4 lg:grid-cols-2">
            <ContentMixChart
              data={contentMix}
              title={periodLabel ? `ترکیب محتوا (${periodLabel})` : "ترکیب محتوای این شرکت"}
            />
            <UploadActivityChart
              stats={uploadStats}
              onTodayClick={() => setTodayDialogOpen(true)}
            />
          </div>

          <CompanyPresenceTimeline activity={dayActivity} loading={dayActivityLoading} />

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold">آپلودهای امروز</h2>
              <Badge variant="secondary">{formatPersianNumber(todayItems.length)}</Badge>
            </div>
            {renderSimpleGrid(todayItems, "امروز هنوز محتوایی آپلود نشده است.")}
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold">برگشتی‌های امروز</h2>
              <Badge variant="destructive">
                {formatPersianNumber(todayReturnedItems.length)}
              </Badge>
            </div>
            {renderSimpleGrid(todayReturnedItems, "امروز محتوای برگشتی ثبت نشده است.")}
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold">خطاهای امروز</h2>
              <Badge variant="outline">
                {formatPersianNumber(dayActivity?.errorEvents.length ?? 0)}
              </Badge>
            </div>
            {dayActivityLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                در حال بارگذاری خطاها...
              </div>
            ) : (
              <ErrorEventCards events={dayActivity?.errorEvents ?? []} />
            )}
          </section>

          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold">پیام‌های امروز</h2>
              <Badge variant="secondary">{formatPersianNumber(todayMessages.length)}</Badge>
            </div>
            {messagesLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                در حال بارگذاری پیام‌ها...
              </div>
            ) : (
              <MessageList
                messages={todayMessages}
                emptyText="امروز پیامی برای این شرکت ثبت نشده است."
              />
            )}
          </section>
        </TabsContent>

        <TabsContent value="content" className="space-y-4">
          <OwnerLocationFilterBar />

          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={typeFilter}
              onValueChange={(value) =>
                setTypeFilter(value as CompanySupervisionContentType | "all")
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="نوع محتوا" />
              </SelectTrigger>
              <SelectContent dir="rtl">
                {COMPANY_SUPERVISION_TYPE_FILTERS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={reviewFilter}
              onValueChange={(value) =>
                setReviewFilter(value as CompanySupervisionReviewFilter)
              }
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="وضعیت بازبینی" />
              </SelectTrigger>
              <SelectContent dir="rtl">
                {COMPANY_SUPERVISION_REVIEW_FILTERS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <EmptyFieldFilterSelect
              value={emptyField}
              onChange={setEmptyField}
              className="w-[260px]"
            />

            <p className="text-sm text-muted-foreground">
              {formatPersianNumber(filteredContent.length)} مورد
              {!showAllCategoryCards && (
                <span className="ms-2 text-xs">
                  (بدون فیلتر حداکثر {formatPersianNumber(COMPANY_CATEGORY_CARD_LIMIT)} در هر
                  دسته)
                </span>
              )}
            </p>
          </div>
          {renderBulkToolbar()}
          {renderGroupedGrid(filteredContent, true)}
        </TabsContent>

        <TabsContent value="returned" className="space-y-4">
          {returnedItems.length === 0 ? (
            <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
              محتوای برگشتی برای این شرکت نیست.
            </div>
          ) : (
            <>
              {renderBulkToolbar()}
              {renderGroupedGrid(returnedItems, false)}
            </>
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

      <Dialog open={todayDialogOpen} onOpenChange={setTodayDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto text-right" dir="rtl">
          <DialogHeader className="text-right sm:text-right">
            <DialogTitle>
              فعالیت امروز ({formatPersianNumber(todayItems.length)} آپلود)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-8">
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">آپلودهای امروز</h3>
                <Badge variant="secondary">{formatPersianNumber(todayItems.length)}</Badge>
              </div>
              {renderSimpleGrid(todayItems, "امروز هنوز محتوایی آپلود نشده است.")}
            </section>
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">برگشتی‌های امروز</h3>
                <Badge variant="destructive">
                  {formatPersianNumber(todayReturnedItems.length)}
                </Badge>
              </div>
              {renderSimpleGrid(todayReturnedItems, "امروز محتوای برگشتی ثبت نشده است.")}
            </section>
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">خطاهای امروز</h3>
                <Badge variant="outline">
                  {formatPersianNumber(dayActivity?.errorEvents.length ?? 0)}
                </Badge>
              </div>
              <ErrorEventCards events={dayActivity?.errorEvents ?? []} />
            </section>
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">پیام‌های امروز</h3>
                <Badge variant="secondary">{formatPersianNumber(todayMessages.length)}</Badge>
              </div>
              <MessageList
                messages={todayMessages}
                emptyText="امروز پیامی برای این شرکت ثبت نشده است."
              />
            </section>
          </div>
        </DialogContent>
      </Dialog>

      <SupervisionItemDialog
        item={viewingItem}
        open={Boolean(viewingItem)}
        onOpenChange={(open) => {
          if (!open) setViewingItem(null);
        }}
        campaignId={campaignId}
        canScore={canScore}
        canSendMessage={canSendMessage}
        canManageReviews={canManageReviews}
        reviewPending={Boolean(viewingItem && isPending && pendingKey === viewingItem.key)}
        onApprove={() => viewingItem && runApprove(viewingItem)}
        onReject={() => {
          if (!viewingItem) return;
          setRejectingBulk(false);
          setRejectingItem(viewingItem);
          setRejectionReason(referralReasonForEmptyItems([viewingItem], emptyField));
        }}
      />

      <Dialog
        open={Boolean(rejectingItem) || rejectingBulk}
        onOpenChange={(open) => {
          if (!open) {
            setRejectingItem(null);
            setRejectingBulk(false);
            setRejectionReason("");
          }
        }}
      >
        <DialogContent className="text-right" dir="rtl">
          <DialogHeader className="text-right sm:text-right">
            <DialogTitle>{rejectingBulk ? "رد گروهی با دلیل" : "رد محتوا با دلیل"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {rejectingBulk
                ? `دلیل رد روی ${formatPersianNumber(selectedReviewItems.length)} مورد انتخاب‌شده اعمال می‌شود.`
                : `${rejectingItem?.title} — ${rejectingItem?.typeLabel}`}
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
                setRejectingBulk(false);
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
              {rejectingBulk ? "ثبت رد گروهی" : "ثبت رد"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={approveBulkOpen} onOpenChange={setApproveBulkOpen}>
        <DialogContent className="text-right" dir="rtl">
          <DialogHeader className="text-right sm:text-right">
            <DialogTitle>تایید گروهی محتوا</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {formatPersianNumber(selectedApprovableItems.length)} مورد تایید و منتشر شود؟
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setApproveBulkOpen(false)}
              disabled={isPending}
            >
              انصراف
            </Button>
            <Button type="button" disabled={isPending} onClick={runBulkApprove}>
              تایید گروهی
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
