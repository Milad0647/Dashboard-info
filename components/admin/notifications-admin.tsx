"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ExternalLink } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { AdminContentPreviewDialog } from "@/components/admin/admin-content-preview-dialog";
import { ContentScoreControl } from "@/components/admin/content-score-control";
import { VideoModal } from "@/components/media/video-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MediaPlaceholder } from "@/components/ui/media-placeholder";
import {
  getNotificationReadsAction,
  markNotificationsSeenAction,
} from "@/lib/actions/notification-actions";
import {
  buildNotificationFeed,
  collectNotificationOwners,
  collectNotificationPlans,
  collectNotificationProvinces,
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
import { resolveDisplayVersion } from "@/lib/media-utils";
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
}

function NotificationCard({
  item,
  campaignId,
  canScore,
  selected,
  onToggleSelect,
  onOpen,
  showConfirm,
  confirming,
  onConfirm,
  onScoreSaved,
}: {
  item: NotificationFeedItem;
  campaignId: string;
  canScore: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
  showConfirm?: boolean;
  confirming?: boolean;
  onConfirm?: () => void;
  onScoreSaved?: (score: number | null) => void;
}) {
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
            canScore={canScore}
            compact
            onScoreSaved={onScoreSaved}
          />
        </div>
      )}

      {showConfirm && onConfirm && (
        <div className="flex items-center gap-2 border-t p-3">
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
          <Button type="button" variant="ghost" size="icon" className="shrink-0" asChild>
            <Link href={item.adminPath} title="ویرایش در پنل">
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}
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
}: NotificationsAdminProps) {
  const router = useRouter();
  const [view, setView] = useState<NotificationFilterView>("new");
  const [range, setRange] = useState<NotificationRange>("week");
  const [sort, setSort] = useState<NotificationSort>("upload");
  const [province, setProvince] = useState("all");
  const [ownerName, setOwnerName] = useState("all");
  const [planLabel, setPlanLabel] = useState("all");
  const [seenKeys, setSeenKeys] = useState<Set<string>>(new Set());
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [scoreOverrides, setScoreOverrides] = useState<Record<string, number | null>>({});
  const [readsLoaded, setReadsLoaded] = useState(false);
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<NotificationFeedItem | null>(null);
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

    if (view === "unscored") {
      return items.filter((item) => item.score == null);
    }

    return items.filter((item) => (view === "seen" ? seenKeys.has(item.key) : !seenKeys.has(item.key)));
  }, [feed, range, province, ownerName, planLabel, view, seenKeys]);

  const grouped = useMemo(() => {
    const map = new Map<string, NotificationFeedItem[]>();
    for (const item of filtered) {
      const list = map.get(item.date) ?? [];
      list.push(item);
      map.set(item.date, list);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((item) => selectedKeys.has(item.key));

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedKeys(new Set());
      return;
    }
    setSelectedKeys(new Set(filtered.map((item) => item.key)));
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
        {filtered.length > 0 && (
          <Button variant="outline" onClick={toggleSelectAll}>
            {allFilteredSelected ? "لغو انتخاب همه" : "انتخاب همه"}
          </Button>
        )}
        {selectedKeys.size > 0 && (
          <Button variant="outline" onClick={handleConfirmSelected} disabled={isPending}>
            علامت‌گذاری دیده‌شده ({formatPersianNumber(selectedKeys.size)})
          </Button>
        )}
      </div>

      <div className="rounded-xl border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          {view === "new"
            ? "موارد جدید"
            : view === "seen"
              ? "دیده‌شده‌ها"
              : "امتیاز نداده‌ها"}
          : {formatPersianNumber(filtered.length)}
          {view === "new" && " — موارد فقط با تأیید صریح به‌عنوان دیده‌شده ثبت می‌شوند."}
          {view === "unscored" && canScore && " — روی هر کارت می‌توانید امتیاز بدهید."}
        </p>
      </div>

      {!readsLoaded ? (
        <div className="rounded-xl border py-12 text-center text-muted-foreground">در حال بارگذاری...</div>
      ) : grouped.length === 0 ? (
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
                    selected={selectedKeys.has(item.key)}
                    onToggleSelect={() => toggleSelect(item.key)}
                    onOpen={() => setPreviewItem(item)}
                    showConfirm={view === "new" || view === "unscored"}
                    confirming={confirmingKey === item.key}
                    onConfirm={() => handleConfirmItem(item.key)}
                    onScoreSaved={(score) => {
                      setScoreOverrides((prev) => ({ ...prev, [item.key]: score }));
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
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
        />
      ) : (
        <AdminContentPreviewDialog
          open={Boolean(previewItem)}
          onOpenChange={(open) => !open && setPreviewItem(null)}
          title={previewItem?.title ?? "پیش‌نمایش اعلان"}
          description={previewDescription}
          imageUrl={previewItem?.thumbnailUrl}
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
    </div>
  );
}
