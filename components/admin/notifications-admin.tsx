"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
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

interface NotificationsAdminProps {
  campaignId: string;
  isAdmin: boolean;
  posters: Poster[];
  videos: Video[];
  billboards: Billboard[];
  activities: CampaignActivity[];
  socialPosts: SocialMediaPost[];
  posterVersions?: PosterVersion[];
  videoVersions?: VideoVersion[];
}

function NotificationCard({ item }: { item: NotificationFeedItem }) {
  return (
    <Link
      href={item.adminPath}
      className="group flex flex-col overflow-hidden rounded-xl border bg-card transition hover:border-primary hover:shadow-md"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {item.thumbnailUrl ? (
          <Image
            src={item.thumbnailUrl}
            alt={item.title}
            fill
            className="object-cover transition-transform group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        ) : (
          <MediaPlaceholder kind="poster" className="h-full w-full" />
        )}
        <div className="absolute top-2 right-2 flex flex-wrap gap-1 justify-end">
          <Badge variant="secondary" className="text-[10px]">
            {item.typeLabel}
          </Badge>
          {!item.published && (
            <Badge variant="outline" className="text-[10px] bg-background/90">
              پیش‌نویس
            </Badge>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="font-medium leading-snug line-clamp-2">{item.title}</p>
        <div className="space-y-1 text-xs text-muted-foreground">
          <p>{item.ownerName ?? "کاربر"}</p>
          {(item.ownerProvince || item.ownerCity) && (
            <p>
              {[item.ownerProvince, item.ownerCity].filter(Boolean).join(" / ")}
            </p>
          )}
          {item.planLabel && <p>طرح: {item.planLabel}</p>}
        </div>
        <p className="mt-auto text-[11px] text-muted-foreground">
          {formatPersianDateTime(item.eventAt)}
        </p>
      </div>
    </Link>
  );
}

export function NotificationsAdmin({
  campaignId,
  isAdmin,
  posters,
  videos,
  billboards,
  activities,
  socialPosts,
  posterVersions = [],
  videoVersions = [],
}: NotificationsAdminProps) {
  const [view, setView] = useState<NotificationView>("new");
  const [range, setRange] = useState<NotificationRange>("week");
  const [sort, setSort] = useState<NotificationSort>("upload");
  const [province, setProvince] = useState("all");
  const [ownerName, setOwnerName] = useState("all");
  const [planLabel, setPlanLabel] = useState("all");
  const [seenKeys, setSeenKeys] = useState<Set<string>>(new Set());
  const [readsLoaded, setReadsLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();
  const pendingSeenRef = useRef<string[]>([]);

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
          posters,
          videos,
          billboards,
          activities,
          socialPosts,
          posterVersions,
          videoVersions,
        }),
        sort
      ),
    [posters, videos, billboards, activities, socialPosts, posterVersions, videoVersions, sort]
  );

  const provinces = useMemo(() => collectNotificationProvinces(feed), [feed]);
  const owners = useMemo(() => collectNotificationOwners(feed), [feed]);
  const plans = useMemo(() => collectNotificationPlans(feed), [feed]);

  const filtered = useMemo(() => {
    let items = filterNotificationFeed(feed, range);
    items = filterNotificationByProvince(items, province);
    items = filterNotificationByOwner(items, ownerName);
    items = filterNotificationByPlan(items, planLabel);
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

  useEffect(() => {
    if (!readsLoaded || view !== "new" || filtered.length === 0) return;
    pendingSeenRef.current = filtered.map((item) => item.key);
  }, [filtered, readsLoaded, view]);

  useEffect(() => {
    return () => {
      const keys = pendingSeenRef.current;
      if (keys.length === 0) return;
      void markNotificationsSeenAction(campaignId, keys);
    };
  }, [campaignId]);

  const handleConfirm = () => {
    if (view !== "new" || filtered.length === 0) return;

    startTransition(async () => {
      const keys = filtered.map((item) => item.key);
      const result = await markNotificationsSeenAction(campaignId, keys, true);
      if (!result.success) {
        toast.error("ثبت تأیید ناموفق بود");
        return;
      }
      setSeenKeys((prev) => new Set([...prev, ...keys]));
      pendingSeenRef.current = [];
      toast.success("موارد مشاهده‌شده تأیید شد");
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
        <Tabs value={view} onValueChange={(value) => setView(value as NotificationView)}>
          <TabsList>
            <TabsTrigger value="new">جدید</TabsTrigger>
            <TabsTrigger value="seen">دیده‌شده‌ها</TabsTrigger>
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
              <SelectValue placeholder="طرح" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه طرح‌ها</SelectItem>
              {plans.map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {view === "new" && filtered.length > 0 && (
          <Button variant="outline" onClick={handleConfirm} disabled={isPending}>
            تأیید مشاهده ({formatPersianNumber(filtered.length)})
          </Button>
        )}
      </div>

      <div className="rounded-xl border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          {view === "new" ? "موارد جدید" : "دیده‌شده‌ها"}: {formatPersianNumber(filtered.length)}
          {view === "new" && " — با خروج از صفحه، موارد نمایش‌داده‌شده به‌عنوان دیده‌شده ثبت می‌شوند."}
        </p>
      </div>

      {!readsLoaded ? (
        <div className="rounded-xl border py-12 text-center text-muted-foreground">در حال بارگذاری...</div>
      ) : grouped.length === 0 ? (
        <div className="rounded-xl border py-12 text-center text-muted-foreground">
          {view === "new" ? "اعلان جدیدی در این فیلتر وجود ندارد." : "مورد دیده‌شده‌ای در این فیلتر وجود ندارد."}
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, items]) => (
            <div key={date} className="space-y-3">
              <h2 className="text-sm font-semibold">{formatPersianDate(date)}</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {items.map((item) => (
                  <NotificationCard key={item.key} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
