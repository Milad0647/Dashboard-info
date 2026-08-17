"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ExternalLink } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { AdminContentPreviewDialog } from "@/components/admin/admin-content-preview-dialog";
import { ContentScoreControl } from "@/components/admin/content-score-control";
import { SendContentMessageButton } from "@/components/admin/send-content-message-button";
import { VideoModal } from "@/components/media/video-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import { BulkContentReviewActions, BulkTopicEditPanel } from "@/components/admin/bulk-content-review-bar";
import { EmptyFieldFilterSelect } from "@/components/admin/empty-field-filter-select";
import { EmptyFieldsBadges } from "@/components/admin/empty-fields-badges";
import {
  approveContentAction,
  bulkApproveContentAction,
  bulkRejectContentForRevisionAction,
  rejectContentForRevisionAction,
} from "@/lib/actions/content-review-actions";
import { bulkUpdatePlanLabelsAction } from "@/lib/actions/bulk-update-actions";
import { isReviewableContentType } from "@/lib/content-review/types";
import type { ContentTopic } from "@/lib/content-topics";
import {
  getNotificationReadsAction,
  markNotificationsSeenAction,
} from "@/lib/actions/notification-actions";
import {
  buildNotificationFeed,
  collectNotificationOwners,
  collectNotificationPlans,
  collectNotificationProvinces,
  filterNotificationByEmptyField,
  filterNotificationByOwner,
  filterNotificationByPlan,
  filterNotificationByProvince,
  filterNotificationFeed,
  sortNotificationFeed,
  type NotificationFeedItem,
  type NotificationRange,
  type NotificationSort,
  type NotificationView,
} from "@/lib/notification-feed";
import {
  referralReasonForEmptyItems,
  type EmptyFieldFilter,
} from "@/lib/empty-content-fields";
import { resolveDisplayVersion } from "@/lib/media-utils";
import type { ContentReview } from "@/lib/content-review/types";
import type {
  Billboard,
  CampaignActivity,
  Poster,
  PosterVersion,
  SocialMediaPost,
  Video,
  VideoVersion,
} from "@/lib/types";
import { formatPersianDate, formatPersianDateTime, formatPersianNumber } from "@/lib/utils";

const NOTIFICATIONS_PAGE_SIZE = 50;

function getNotificationDescription(
  item: NotificationFeedItem,
  sources: {
    posters: Poster[];
    videos: Video[];
    billboards: Billboard[];
    activities: CampaignActivity[];
    socialPosts: SocialMediaPost[];
  }
): string | null {
  switch (item.contentType) {
    case "poster":
      return sources.posters.find((row) => row.id === item.contentId)?.description ?? null;
    case "video":
      return sources.videos.find((row) => row.id === item.contentId)?.description ?? null;
    case "billboard":
      return sources.billboards.find((row) => row.id === item.contentId)?.description ?? null;
    case "activity":
      return sources.activities.find((row) => row.id === item.contentId)?.description ?? null;
    case "social_post":
    case "site_publication":
      return sources.socialPosts.find((row) => row.id === item.contentId)?.description ?? null;
    default:
      return null;
  }
}

type NotificationFilterView = NotificationView | "unscored";

interface NotificationsAdminProps {
  campaignId: string;
  isAdmin: boolean;
  canScore?: boolean;
  posters: Poster[];
  videos: Video[];
  billboards: Billboard[];
  activities: CampaignActivity[];
  socialPosts: SocialMediaPost[];
  posterVersions?: PosterVersion[];
  videoVersions?: VideoVersion[];
  contentReviews?: ContentReview[];
  canManageReviews?: boolean;
  contentTopics?: ContentTopic[];
  contentPlans?: string[];
}

function NotificationCard({
  item,
  campaignId,
  canScore,
  canSendMessage,
  selected,
  onToggleSelect,
  onOpen,
  showConfirm,
  confirming,
  onConfirm,
  canManageReviews,
  reviewStatus,
  onApprove,
  onReject,
  reviewPending,
  onScoreSaved,
}: {
  item: NotificationFeedItem;
  campaignId: string;
  canScore: boolean;
  canSendMessage: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
  showConfirm?: boolean;
  confirming?: boolean;
  onConfirm?: () => void;
  canManageReviews?: boolean;
  reviewStatus?: "needs_revision" | "resubmitted" | "approved" | null;
  onApprove?: () => void;
  onReject?: () => void;
  reviewPending?: boolean;
  onScoreSaved?: (score: number | null) => void;
}) {
  const reviewStatusLabel =
    reviewStatus === "needs_revision"
      ? "برگشت برای ویرایش"
      : reviewStatus === "resubmitted"
        ? "ارسال‌مجدد"
        : reviewStatus === "approved"
          ? "تاییدشده"
          : null;

  return (
    <div className="apple-lift group flex flex-col overflow-hidden rounded-xl border bg-card hover:border-primary/50">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="h-4 w-4 accent-primary"
          aria-label={`انتخاب ${item.title}`}
        />
        <span className="text-xs text-muted-foreground">انتخاب</span>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="flex flex-1 flex-col text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
          {item.thumbnailUrl ? (
            <Image
              src={item.thumbnailUrl}
              alt={item.title}
              fill
              className="apple-media-zoom object-cover"
              sizes="(max-width: 768px) 100vw, 33vw"
            />
          ) : (
            <MediaPlaceholder kind="poster" className="h-full w-full" />
          )}
          <div className="absolute top-2 right-2 flex flex-wrap justify-end gap-1">
            <Badge variant="overlay" className="text-[10px]">
              {item.typeLabel}
            </Badge>
            {item.score == null ? (
              <Badge variant="overlay" className="text-[10px]">
                بدون امتیاز
              </Badge>
            ) : (
              <Badge variant="overlay" className="text-[10px]">
                امتیاز {formatPersianNumber(item.score)}
              </Badge>
            )}
            {reviewStatusLabel && (
              <Badge variant="overlay" className="text-[10px]">
                {reviewStatusLabel}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4">
          <p className="line-clamp-2 font-medium leading-snug">{item.title}</p>
          <div className="space-y-1 text-xs text-muted-foreground">
            <p>{item.ownerName ?? "کاربر"}</p>
            {(item.ownerProvince || item.ownerCity) && (
              <p>{[item.ownerProvince, item.ownerCity].filter(Boolean).join(" / ")}</p>
            )}
            {item.planLabel && <p>موضوع: {item.planLabel}</p>}
            <EmptyFieldsBadges fields={item.emptyFields} className="pt-1" />
          </div>
          <p className="mt-auto text-[11px] text-muted-foreground">
            {formatPersianDateTime(item.eventAt)}
          </p>
        </div>
      </button>

      {canScore && (
        <div className="border-t px-3 py-2" onClick={(event) => event.stopPropagation()}>
          <ContentScoreControl
            campaignId={campaignId}
            contentType={item.contentType}
            contentId={item.contentId}
            score={item.score}
            autoScore={item.autoScore}
            manualScore={item.manualScore}
            canScore={canScore}
            compact
            onScoreSaved={onScoreSaved}
          />
        </div>
      )}

      {(showConfirm && onConfirm) || canSendMessage ? (
        <div className="flex items-center gap-2 border-t p-3">
          {showConfirm && onConfirm ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 gap-2"
              disabled={confirming}
              onClick={onConfirm}
            >
              <Check className="h-4 w-4" />
              تأیید مشاهده
            </Button>
          ) : null}
          {canSendMessage && (
            <SendContentMessageButton
              target={{
                campaignId,
                contentType: item.contentType,
                contentId: item.contentId,
                contentTitle: item.title,
                ownerName: item.ownerName,
              }}
              compact
            />
          )}
          {canManageReviews && onApprove && onReject && reviewStatus !== "approved" ? (
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
          ) : null}
          <Button type="button" variant="ghost" size="icon" className="shrink-0" asChild>
            <Link href={item.adminPath} title="ویرایش در پنل">
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function NotificationsAdmin({
  campaignId,
  isAdmin,
  canScore = false,
  posters,
  videos,
  billboards,
  activities,
  socialPosts,
  posterVersions = [],
  videoVersions = [],
  contentReviews = [],
  canManageReviews = false,
  contentTopics = [],
  contentPlans = [],
}: NotificationsAdminProps) {
  const router = useRouter();
  const [view, setView] = useState<NotificationFilterView>("new");
  const [range, setRange] = useState<NotificationRange>("week");
  const [sort, setSort] = useState<NotificationSort>("upload");
  const [province, setProvince] = useState("all");
  const [ownerName, setOwnerName] = useState("all");
  const [planLabel, setPlanLabel] = useState("all");
  const [emptyField, setEmptyField] = useState<EmptyFieldFilter>("all");
  const [seenKeys, setSeenKeys] = useState<Set<string>>(new Set());
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [scoreOverrides, setScoreOverrides] = useState<Record<string, number | null>>({});
  const [readsLoaded, setReadsLoaded] = useState(false);
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<NotificationFeedItem | null>(null);
  const [reviewPendingKey, setReviewPendingKey] = useState<string | null>(null);
  const [rejectingItem, setRejectingItem] = useState<NotificationFeedItem | null>(null);
  const [rejectingBulk, setRejectingBulk] = useState(false);
  const [approveBulkOpen, setApproveBulkOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [page, setPage] = useState(1);
  const [isPending, startTransition] = useTransition();

  const previewDescription = useMemo(() => {
    if (!previewItem) return null;
    return getNotificationDescription(previewItem, {
      posters,
      videos,
      billboards,
      activities,
      socialPosts,
    });
  }, [previewItem, posters, videos, billboards, activities, socialPosts]);

  const previewVideoVersions = useMemo(() => {
    if (!previewItem || previewItem.contentType !== "video") return [];
    return videoVersions
      .filter((version) => version.videoId === previewItem.contentId)
      .sort((a, b) => b.versionNumber - a.versionNumber);
  }, [previewItem, videoVersions]);

  const previewVideoDisplay = useMemo(
    () => resolveDisplayVersion(previewVideoVersions),
    [previewVideoVersions]
  );

  useEffect(() => {
    void getNotificationReadsAction().then((keys) => {
      setSeenKeys(new Set(keys));
      setReadsLoaded(true);
    });
  }, []);

  const feed = useMemo(
    () =>
      sortNotificationFeed(
        buildNotificationFeed({
          campaignId,
          posters,
          videos,
          billboards,
          activities,
          socialPosts,
          posterVersions,
          videoVersions,
        }).map((item) =>
          Object.prototype.hasOwnProperty.call(scoreOverrides, item.key)
            ? { ...item, score: scoreOverrides[item.key] }
            : item
        ),
        sort
      ),
    [
      campaignId,
      posters,
      videos,
      billboards,
      activities,
      socialPosts,
      posterVersions,
      videoVersions,
      sort,
      scoreOverrides,
    ]
  );

  const provinces = useMemo(() => collectNotificationProvinces(feed), [feed]);
  const owners = useMemo(() => collectNotificationOwners(feed), [feed]);
  const plans = useMemo(() => collectNotificationPlans(feed), [feed]);

  const filtered = useMemo(() => {
    let items = filterNotificationFeed(feed, range);
    items = filterNotificationByProvince(items, province);
    items = filterNotificationByOwner(items, ownerName);
    items = filterNotificationByPlan(items, planLabel);
    items = filterNotificationByEmptyField(items, emptyField);

    if (view === "unscored") {
      return items.filter((item) => item.score == null);
    }

    return items.filter((item) => (view === "seen" ? seenKeys.has(item.key) : !seenKeys.has(item.key)));
  }, [feed, range, province, ownerName, planLabel, emptyField, view, seenKeys]);

  const paginationResetKey = `${view}:${range}:${sort}:${province}:${ownerName}:${planLabel}:${emptyField}`;

  useEffect(() => {
    setPage(1);
  }, [paginationResetKey]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / NOTIFICATIONS_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const visibleItems = useMemo(() => {
    const start = (currentPage - 1) * NOTIFICATIONS_PAGE_SIZE;
    return filtered.slice(start, start + NOTIFICATIONS_PAGE_SIZE);
  }, [filtered, currentPage]);

  const grouped = useMemo(() => {
    const map = new Map<string, NotificationFeedItem[]>();
    for (const item of visibleItems) {
      const list = map.get(item.date) ?? [];
      list.push(item);
      map.set(item.date, list);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [visibleItems]);

  const reviewByKey = useMemo(() => {
    const map = new Map<string, ContentReview>();
    for (const review of contentReviews) {
      map.set(`${review.contentType}:${review.contentId}`, review);
    }
    return map;
  }, [contentReviews]);

  const selectedReviewableItems = useMemo(
    () =>
      filtered.filter(
        (item) => selectedKeys.has(item.key) && isReviewableContentType(item.contentType)
      ),
    [filtered, selectedKeys]
  );

  const selectedApprovableItems = useMemo(
    () =>
      selectedReviewableItems.filter(
        (item) => reviewByKey.get(`${item.contentType}:${item.contentId}`)?.status !== "approved"
      ),
    [selectedReviewableItems, reviewByKey]
  );

  const allVisibleSelected =
    visibleItems.length > 0 && visibleItems.every((item) => selectedKeys.has(item.key));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        for (const item of visibleItems) next.delete(item.key);
        return next;
      });
      return;
    }
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      for (const item of visibleItems) next.add(item.key);
      return next;
    });
  };

  const toggleSelect = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const markKeysSeen = (keys: string[]) => {
    if (keys.length === 0) return;
    startTransition(async () => {
      const result = await markNotificationsSeenAction(campaignId, keys, true);
      if (!result.success) {
        toast.error("ثبت تأیید ناموفق بود");
        return;
      }
      setSeenKeys((prev) => new Set([...prev, ...keys]));
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        for (const key of keys) next.delete(key);
        return next;
      });
      toast.success("موارد انتخاب‌شده به‌عنوان دیده‌شده ثبت شد");
    });
  };

  const handleConfirmSelected = () => {
    markKeysSeen([...selectedKeys].filter((key) => filtered.some((item) => item.key === key)));
  };

  const handleConfirmItem = (key: string) => {
    if (seenKeys.has(key)) return;
    setConfirmingKey(key);
    startTransition(async () => {
      const result = await markNotificationsSeenAction(campaignId, [key], true);
      setConfirmingKey(null);
      if (!result.success) {
        toast.error("ثبت تأیید ناموفق بود");
        return;
      }
      setSeenKeys((prev) => new Set([...prev, key]));
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      toast.success("مشاهده تأیید شد");
    });
  };

  const approveItem = (item: NotificationFeedItem) => {
    if (!canManageReviews) return;
    setReviewPendingKey(item.key);
    startTransition(async () => {
      const result = await approveContentAction({
        campaignId,
        contentType: item.contentType,
        contentId: item.contentId,
        notificationKey: item.key,
      });
      setReviewPendingKey(null);
      if (!result.success) {
        toast.error(result.error ?? "تایید محتوا ناموفق بود");
        return;
      }
      setSeenKeys((prev) => new Set([...prev, item.key]));
      toast.success("محتوا تایید شد");
      router.refresh();
    });
  };

  const openRejectDialog = (item: NotificationFeedItem) => {
    setRejectingBulk(false);
    setRejectingItem(item);
    setRejectionReason(referralReasonForEmptyItems([item], emptyField));
  };

  const submitReject = () => {
    const reason = rejectionReason.trim();
    if (reason.length < 3) {
      toast.error("دلیل رد حداقل ۳ کاراکتر باشد");
      return;
    }

    if (rejectingBulk) {
      if (selectedReviewableItems.length === 0) return;
      startTransition(async () => {
        const result = await bulkRejectContentForRevisionAction({
          campaignId,
          items: selectedReviewableItems.map((item) => ({
            contentType: item.contentType,
            contentId: item.contentId,
            notificationKey: item.key,
          })),
          rejectionReason: reason,
        });
        if (!result.success) {
          toast.error(result.error ?? "رد گروهی ناموفق بود");
          return;
        }
        const seen = selectedReviewableItems.map((item) => item.key);
        setSeenKeys((prev) => new Set([...prev, ...seen]));
        setSelectedKeys(new Set());
        setRejectingBulk(false);
        setRejectionReason("");
        const extra =
          result.skipped > 0 || result.failed > 0
            ? ` — ${formatPersianNumber(result.skipped)} ردشده از قبل / ${formatPersianNumber(result.failed)} ناموفق`
            : "";
        toast.success(`${formatPersianNumber(result.processed)} محتوا برای ویرایش برگشت داده شد${extra}`);
        router.refresh();
      });
      return;
    }

    if (!rejectingItem) return;
    setReviewPendingKey(rejectingItem.key);
    startTransition(async () => {
      const result = await rejectContentForRevisionAction({
        campaignId,
        contentType: rejectingItem.contentType,
        contentId: rejectingItem.contentId,
        rejectionReason: reason,
        notificationKey: rejectingItem.key,
      });
      setReviewPendingKey(null);
      if (!result.success) {
        toast.error(result.error ?? "رد محتوا ناموفق بود");
        return;
      }
      setSeenKeys((prev) => new Set([...prev, rejectingItem.key]));
      setRejectingItem(null);
      setRejectionReason("");
      toast.success("محتوا برای ویرایش برگشت داده شد");
      router.refresh();
    });
  };

  const submitBulkApprove = () => {
    if (selectedApprovableItems.length === 0) return;
    startTransition(async () => {
      const result = await bulkApproveContentAction({
        campaignId,
        items: selectedApprovableItems.map((item) => ({
          contentType: item.contentType,
          contentId: item.contentId,
          notificationKey: item.key,
        })),
      });
      setApproveBulkOpen(false);
      if (!result.success) {
        toast.error(result.error ?? "تایید گروهی ناموفق بود");
        return;
      }
      const seen = selectedApprovableItems.map((item) => item.key);
      setSeenKeys((prev) => new Set([...prev, ...seen]));
      setSelectedKeys(new Set());
      const extra =
        result.skipped > 0 || result.failed > 0
          ? ` — ${formatPersianNumber(result.skipped)} تاییدشده از قبل / ${formatPersianNumber(result.failed)} ناموفق`
          : "";
      toast.success(`${formatPersianNumber(result.processed)} محتوا تایید شد${extra}`);
      router.refresh();
    });
  };

  const submitBulkTopic = (planLabels: string[]) => {
    const selectedItems = filtered.filter((item) => selectedKeys.has(item.key));
    if (selectedItems.length === 0) {
      toast.error("حداقل یک مورد را انتخاب کنید");
      return;
    }
    startTransition(async () => {
      const result = await bulkUpdatePlanLabelsAction({
        campaignId,
        items: selectedItems.map((item) => ({
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
      setSelectedKeys(new Set());
      router.refresh();
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">اعلان‌ها</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin ? "مدیر و کارفرما" : "کارفرما"} — محتوای آپلودشده با نمایش کارتی
          </p>
        </div>
        <Tabs value={view} onValueChange={(value) => setView(value as NotificationFilterView)}>
          <TabsList>
            <TabsTrigger value="new">جدید</TabsTrigger>
            <TabsTrigger value="seen">دیده‌شده‌ها</TabsTrigger>
            <TabsTrigger value="unscored">امتیاز نداده‌ها</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={sort} onValueChange={(value) => setSort(value as NotificationSort)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="upload">زمان آپلود</SelectItem>
            <SelectItem value="date">تاریخ روز</SelectItem>
            <SelectItem value="owner">کاربر</SelectItem>
            <SelectItem value="province">استان</SelectItem>
          </SelectContent>
        </Select>
        <Select value={range} onValueChange={(value) => setRange(value as NotificationRange)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">امروز</SelectItem>
            <SelectItem value="week">این هفته</SelectItem>
            <SelectItem value="month">این ماه</SelectItem>
            <SelectItem value="all">همه</SelectItem>
          </SelectContent>
        </Select>
        {provinces.length > 0 && (
          <Select value={province} onValueChange={setProvince}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="استان" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه استان‌ها</SelectItem>
              {provinces.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {owners.length > 0 && (
          <Select value={ownerName} onValueChange={setOwnerName}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="کاربر" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه کاربران</SelectItem>
              {owners.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {plans.length > 0 && (
          <Select value={planLabel} onValueChange={setPlanLabel}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="موضوع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه موضوع‌ها</SelectItem>
              {plans.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <EmptyFieldFilterSelect
          value={emptyField}
          onChange={setEmptyField}
          className="w-56"
        />
        {visibleItems.length > 0 && (
          <Button variant="outline" onClick={toggleSelectAll}>
            {allVisibleSelected ? "لغو انتخاب همه" : "انتخاب همه در این صفحه"}
          </Button>
        )}
        {selectedKeys.size > 0 && (
          <Button variant="outline" onClick={handleConfirmSelected} disabled={isPending}>
            علامت‌گذاری دیده‌شده ({formatPersianNumber(selectedKeys.size)})
          </Button>
        )}
        {canManageReviews && (
          <BulkContentReviewActions
            selectedCount={selectedKeys.size}
            approveCount={selectedApprovableItems.length}
            rejectCount={selectedReviewableItems.length}
            pending={isPending}
            onApprove={() => setApproveBulkOpen(true)}
            onReject={() => {
              setRejectingItem(null);
              setRejectingBulk(true);
              setRejectionReason(referralReasonForEmptyItems(selectedReviewableItems, emptyField));
            }}
          />
        )}
      </div>

      {canManageReviews && (
        <BulkTopicEditPanel
          selectedCount={selectedKeys.size}
          contentTopics={contentTopics}
          contentPlans={contentPlans}
          pending={isPending}
          onApply={submitBulkTopic}
        />
      )}

      <div className="rounded-xl border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          {view === "new"
            ? "موارد جدید"
            : view === "seen"
              ? "دیده‌شده‌ها"
              : "امتیاز نداده‌ها"}
          : {formatPersianNumber(filtered.length)}
          {filtered.length > NOTIFICATIONS_PAGE_SIZE
            ? ` — نمایش ${formatPersianNumber(visibleItems.length)} مورد در صفحه ${formatPersianNumber(currentPage)} از ${formatPersianNumber(totalPages)}`
            : null}
          {view === "new" && " — موارد فقط با تأیید صریح به‌عنوان دیده‌شده ثبت می‌شوند."}
          {view === "unscored" && canScore && " — روی هر کارت می‌توانید امتیاز بدهید."}
        </p>
      </div>

      {!readsLoaded ? (
        <div className="rounded-xl border py-12 text-center text-muted-foreground">در حال بارگذاری...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border py-12 text-center text-muted-foreground">
          {view === "new"
            ? "اعلان جدیدی در این فیلتر وجود ندارد."
            : view === "seen"
              ? "مورد دیده‌شده‌ای در این فیلتر وجود ندارد."
              : "مورد بدون امتیازی در این فیلتر وجود ندارد."}
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, items]) => (
            <div key={date} className="space-y-3">
              <h2 className="text-sm font-semibold">{formatPersianDate(date)}</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {items.map((item) => (
                  <NotificationCard
                    key={item.key}
                    item={item}
                    campaignId={campaignId}
                    canScore={canScore}
                    canSendMessage
                    selected={selectedKeys.has(item.key)}
                    onToggleSelect={() => toggleSelect(item.key)}
                    onOpen={() => setPreviewItem(item)}
                    showConfirm={view === "new" || view === "unscored"}
                    confirming={confirmingKey === item.key}
                    onConfirm={() => handleConfirmItem(item.key)}
                    canManageReviews={canManageReviews}
                    reviewStatus={reviewByKey.get(`${item.contentType}:${item.contentId}`)?.status ?? null}
                    onApprove={() => approveItem(item)}
                    onReject={() => openRejectDialog(item)}
                    reviewPending={reviewPendingKey === item.key}
                    onScoreSaved={(score) => {
                      setScoreOverrides((prev) => ({ ...prev, [item.key]: score }));
                    }}
                  />
                ))}
              </div>
            </div>
          ))}

          {totalPages > 1 ? (
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={currentPage <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                صفحه قبل
              </Button>
              <span className="text-sm text-muted-foreground">
                صفحه {formatPersianNumber(currentPage)} از {formatPersianNumber(totalPages)}
              </span>
              <Button
                type="button"
                variant="outline"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              >
                صفحه بعد
              </Button>
            </div>
          ) : null}
        </div>
      )}

      {previewItem?.contentType === "video" && previewVideoDisplay ? (
        <VideoModal
          open
          onOpenChange={(open) => !open && setPreviewItem(null)}
          title={previewItem.title}
          versions={previewVideoVersions}
          initialVersionId={previewVideoDisplay.id}
          description={previewDescription}
          topics={previewItem.planLabel ? [previewItem.planLabel] : []}
          ownerName={previewItem.ownerName}
          createdAt={previewItem.createdAt}
          actions={
            <SendContentMessageButton
              target={{
                campaignId,
                contentType: previewItem.contentType,
                contentId: previewItem.contentId,
                contentTitle: previewItem.title,
                ownerName: previewItem.ownerName,
              }}
            />
          }
        />
      ) : (
        <AdminContentPreviewDialog
          open={Boolean(previewItem)}
          onOpenChange={(open) => !open && setPreviewItem(null)}
          title={previewItem?.title ?? "پیش‌نمایش اعلان"}
          description={previewDescription}
          imageUrl={previewItem?.thumbnailUrl}
          canSendMessage
          messageTarget={
            previewItem
              ? {
                  campaignId,
                  contentType: previewItem.contentType,
                  contentId: previewItem.contentId,
                  contentTitle: previewItem.title,
                  ownerName: previewItem.ownerName,
                }
              : null
          }
          meta={
            previewItem ? (
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className="text-[10px]">
                  {previewItem.typeLabel}
                </Badge>
                {previewItem.score == null ? (
                  <Badge variant="warning" className="text-[10px]">
                    بدون امتیاز
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">
                    امتیاز {formatPersianNumber(previewItem.score)}
                  </Badge>
                )}
                {!previewItem.published && (
                  <Badge variant="outline" className="text-[10px]">
                    منتشر نشده
                  </Badge>
                )}
              </div>
            ) : null
          }
          details={
            previewItem
              ? [
                  { label: "کاربر", value: previewItem.ownerName ?? "—" },
                  {
                    label: "موقعیت",
                    value:
                      [previewItem.ownerProvince, previewItem.ownerCity]
                        .filter(Boolean)
                        .join(" / ") || "—",
                  },
                  { label: "موضوع", value: previewItem.planLabel ?? "—" },
                  { label: "تاریخ رویداد", value: formatPersianDateTime(previewItem.eventAt) },
                  { label: "تاریخ روز", value: formatPersianDate(previewItem.date) },
                  { label: "تاریخ ثبت", value: formatPersianDateTime(previewItem.createdAt) },
                ]
              : []
          }
          onEdit={
            previewItem
              ? () => {
                  const path = previewItem.adminPath;
                  setPreviewItem(null);
                  router.push(path);
                }
              : undefined
          }
        />
      )}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {rejectingBulk ? "رد گروهی و برگشت برای ویرایش" : "رد محتوا و برگشت برای ویرایش"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {rejectingBulk ? (
              <p className="text-sm text-muted-foreground">
                دلیل رد روی {formatPersianNumber(selectedReviewableItems.length)} مورد انتخاب‌شده اعمال
                می‌شود.
              </p>
            ) : null}
            <Label htmlFor="rejection-reason">دلیل رد</Label>
            <Textarea
              id="rejection-reason"
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              placeholder="دلیل دقیق رد یا اصلاح موردنیاز را بنویسید..."
              rows={5}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectingItem(null);
                setRejectingBulk(false);
              }}
              disabled={isPending}
            >
              انصراف
            </Button>
            <Button variant="destructive" onClick={submitReject} disabled={isPending}>
              {rejectingBulk ? "ثبت رد گروهی" : "ثبت رد"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={approveBulkOpen} onOpenChange={setApproveBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تایید گروهی محتوا</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {formatPersianNumber(selectedApprovableItems.length)} مورد تایید و منتشر شود؟
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveBulkOpen(false)} disabled={isPending}>
              انصراف
            </Button>
            <Button onClick={submitBulkApprove} disabled={isPending}>
              تایید گروهی
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
