"use client";

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
import {
  getNotificationReadsAction,
  markNotificationsSeenAction,
} from "@/lib/actions/notification-actions";
import {
  buildNotificationFeed,
  filterNotificationFeed,
  sortNotificationFeed,
  type NotificationFeedItem,
  type NotificationRange,
  type NotificationSort,
} from "@/lib/notification-feed";
import type { Billboard, CampaignActivity, Poster, SocialMediaPost, Video } from "@/lib/types";
import { formatPersianDate, formatPersianDateTime, formatPersianNumber } from "@/lib/utils";

interface NotificationsAdminProps {
  campaignId: string;
  isAdmin: boolean;
  posters: Poster[];
  videos: Video[];
  billboards: Billboard[];
  activities: CampaignActivity[];
  socialPosts: SocialMediaPost[];
}

export function NotificationsAdmin({
  campaignId,
  isAdmin,
  posters,
  videos,
  billboards,
  activities,
  socialPosts,
}: NotificationsAdminProps) {
  const [range, setRange] = useState<NotificationRange>("week");
  const [sort, setSort] = useState<NotificationSort>("upload");
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
        buildNotificationFeed({ posters, videos, billboards, activities, socialPosts }),
        sort
      ),
    [posters, videos, billboards, activities, socialPosts, sort]
  );

  const filtered = useMemo(
    () => filterNotificationFeed(feed, range).filter((item) => !seenKeys.has(item.key)),
    [feed, range, seenKeys]
  );

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
    if (!readsLoaded || filtered.length === 0) return;
    pendingSeenRef.current = filtered.map((item) => item.key);
  }, [filtered, readsLoaded]);

  useEffect(() => {
    return () => {
      const keys = pendingSeenRef.current;
      if (keys.length === 0) return;
      void markNotificationsSeenAction(campaignId, keys);
    };
  }, [campaignId]);

  const handleConfirm = () => {
    if (filtered.length === 0) return;

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
            {isAdmin ? "مدیر و کارفرما" : "کارفرما"} — محتوای جدید آپلودشده بر اساس زمان
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={sort} onValueChange={(value) => setSort(value as NotificationSort)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="upload">زمان آپلود</SelectItem>
              <SelectItem value="date">تاریخ روز</SelectItem>
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
            </SelectContent>
          </Select>
          {filtered.length > 0 && (
            <Button variant="outline" onClick={handleConfirm} disabled={isPending}>
              تأیید مشاهده ({formatPersianNumber(filtered.length)})
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          موارد جدید: {formatPersianNumber(filtered.length)} — با خروج از صفحه، موارد نمایش‌داده‌شده
          به‌عنوان دیده‌شده ثبت می‌شوند.
        </p>
      </div>

      {!readsLoaded ? (
        <div className="rounded-xl border py-12 text-center text-muted-foreground">در حال بارگذاری...</div>
      ) : grouped.length === 0 ? (
        <div className="rounded-xl border py-12 text-center text-muted-foreground">
          اعلان جدیدی در این بازه وجود ندارد.
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([date, items]) => (
            <div key={date} className="space-y-3">
              <h2 className="text-sm font-semibold">{formatPersianDate(date)}</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                  <div
                    key={item.key}
                    className="flex flex-col justify-between gap-3 rounded-xl border bg-card p-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium leading-snug">{item.title}</p>
                        <Badge variant="secondary" className="shrink-0">
                          {item.typeLabel}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {item.ownerName ?? "کاربر"}
                      </p>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {formatPersianDateTime(item.eventAt)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
