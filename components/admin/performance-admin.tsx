"use client";

import { useMemo, useState } from "react";
import { Download, LayoutList, Search, Star, Table2, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  buildUserLeaderboard,
  buildUserRatingLeaderboard,
  getProvinceRankBadge,
  type LeaderboardSourceData,
  type UserLeaderboardEntry,
} from "@/lib/city-leaderboard";
import { downloadPerformanceExcel } from "@/lib/services/performance-excel-export";
import { formatPersianNumber } from "@/lib/utils";

type SortMode = "activity" | "rating";
type ViewMode = "cards" | "table";

interface PerformanceAdminProps {
  source: LeaderboardSourceData;
  campaignTitle: string;
  campaignSlug: string;
}

const METRIC_COLUMNS: {
  key: keyof UserLeaderboardEntry;
  label: string;
}[] = [
  { key: "billboards", label: "تبلیغات محیطی" },
  { key: "totalAreaSqm", label: "متراژ" },
  { key: "posters", label: "پوستر" },
  { key: "videos", label: "ویدیو" },
  { key: "socialPosts", label: "شبکه اجتماعی" },
  { key: "sitePublications", label: "انتشار سایت" },
  { key: "activities", label: "اقدام" },
  { key: "files", label: "فایل" },
];

function MetricsBreakdown({ entry }: { entry: UserLeaderboardEntry }) {
  const items = METRIC_COLUMNS.map((column) => ({
    label: column.label,
    value: Number(entry[column.key] ?? 0),
  })).filter((item) => item.value > 0);

  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground">هنوز محتوایی ثبت نشده است.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Badge key={item.label} variant="outline" className="text-[11px]">
          {item.label}: {formatPersianNumber(item.value)}
        </Badge>
      ))}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="space-y-1 p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold tabular-nums">{formatPersianNumber(value)}</p>
      </CardContent>
    </Card>
  );
}

export function PerformanceAdmin({
  source,
  campaignTitle,
  campaignSlug,
}: PerformanceAdminProps) {
  const [sortMode, setSortMode] = useState<SortMode>("activity");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [search, setSearch] = useState("");

  const activityEntries = useMemo(() => buildUserLeaderboard(source), [source]);
  const ratingEntries = useMemo(() => buildUserRatingLeaderboard(source), [source]);
  const entries = sortMode === "rating" ? ratingEntries : activityEntries;

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter(
      (entry) =>
        entry.userName.toLowerCase().includes(query) ||
        entry.province.toLowerCase().includes(query)
    );
  }, [entries, search]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, entry) => {
        acc.users += 1;
        acc.content += entry.totalUploads;
        acc.score += sortMode === "rating" ? entry.ratingScore : entry.score;
        acc.today += entry.todayUploads;
        return acc;
      },
      { users: 0, content: 0, score: 0, today: 0 }
    );
  }, [filtered, sortMode]);

  const handleExport = () => {
    if (filtered.length === 0) {
      toast.error("ردیفی برای خروجی وجود ندارد");
      return;
    }
    try {
      downloadPerformanceExcel(filtered, {
        campaignTitle,
        campaignSlug,
        sortMode,
      });
      toast.success("گزارش اکسل دانلود شد");
    } catch {
      toast.error("خطا در ساخت فایل اکسل");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">مشاهده عملکرد</h1>
          <p className="text-sm text-muted-foreground">
            نمای مدیریتی از آمار عددی همه کاربران کمپین «{campaignTitle}»
          </p>
        </div>
        <Button type="button" onClick={handleExport} className="shrink-0 gap-2">
          <Download className="h-4 w-4" />
          خروجی اکسل
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryStat label="تعداد کاربران" value={totals.users} />
        <SummaryStat label="جمع محتوا" value={totals.content} />
        <SummaryStat
          label={sortMode === "rating" ? "جمع امتیاز محتوا" : "جمع امتیاز فعالیت"}
          value={totals.score}
        />
        <SummaryStat label="محتوای امروز" value={totals.today} />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="جستجوی نام کاربر یا استان..."
              className="pr-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={sortMode === "activity" ? "default" : "outline"}
              onClick={() => setSortMode("activity")}
            >
              <Trophy className="h-4 w-4" />
              امتیاز فعالیت
            </Button>
            <Button
              type="button"
              size="sm"
              variant={sortMode === "rating" ? "default" : "outline"}
              onClick={() => setSortMode("rating")}
            >
              <Star className="h-4 w-4" />
              امتیاز محتوا
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === "cards" ? "default" : "outline"}
              onClick={() => setViewMode("cards")}
            >
              <LayoutList className="h-4 w-4" />
              کارت
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === "table" ? "default" : "outline"}
              onClick={() => setViewMode("table")}
            >
              <Table2 className="h-4 w-4" />
              جدول
            </Button>
          </div>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center text-muted-foreground">
            <Users className="h-8 w-8 opacity-50" />
            <p>کاربری با این فیلتر یافت نشد.</p>
          </CardContent>
        </Card>
      ) : viewMode === "cards" ? (
        <div className="space-y-3">
          {filtered.map((entry) => {
            const scoreValue = sortMode === "rating" ? entry.ratingScore : entry.score;
            return (
              <Card key={entry.userKey}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg">{getProvinceRankBadge(entry.rank)}</span>
                      <p className="font-semibold">{entry.userName}</p>
                      <span className="text-sm text-muted-foreground">— {entry.province}</span>
                      {entry.todayUploads > 0 && (
                        <Badge className="bg-success/15 text-success hover:bg-success/20">
                          +{formatPersianNumber(entry.todayUploads)} امروز
                        </Badge>
                      )}
                    </div>
                    <MetricsBreakdown entry={entry} />
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Badge variant="secondary">
                      {formatPersianNumber(scoreValue)}{" "}
                      {sortMode === "rating" ? "امتیاز محتوا" : "امتیاز"}
                    </Badge>
                    <Badge variant="outline">
                      {formatPersianNumber(entry.totalUploads)} محتوا
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">جدول عملکرد کاربران</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[1100px] border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-muted-foreground">
                  <th className="px-3 py-3 text-right font-medium">رتبه</th>
                  <th className="px-3 py-3 text-right font-medium">کاربر</th>
                  <th className="px-3 py-3 text-right font-medium">استان</th>
                  {METRIC_COLUMNS.map((column) => (
                    <th key={column.key} className="px-3 py-3 text-right font-medium">
                      {column.label}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-right font-medium">محتوا</th>
                  <th className="px-3 py-3 text-right font-medium">امتیاز فعالیت</th>
                  <th className="px-3 py-3 text-right font-medium">امتیاز محتوا</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => (
                  <tr key={entry.userKey} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-3 tabular-nums">{getProvinceRankBadge(entry.rank)}</td>
                    <td className="px-3 py-3 font-medium">
                      <div className="flex flex-wrap items-center gap-2">
                        <span>{entry.userName}</span>
                        {entry.todayUploads > 0 && (
                          <Badge className="bg-success/15 text-success hover:bg-success/20">
                            +{formatPersianNumber(entry.todayUploads)} امروز
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{entry.province}</td>
                    {METRIC_COLUMNS.map((column) => (
                      <td key={column.key} className="px-3 py-3 tabular-nums">
                        {formatPersianNumber(Number(entry[column.key] ?? 0))}
                      </td>
                    ))}
                    <td className="px-3 py-3 tabular-nums font-medium">
                      {formatPersianNumber(entry.totalUploads)}
                    </td>
                    <td className="px-3 py-3 tabular-nums font-medium">
                      {formatPersianNumber(entry.score)}
                    </td>
                    <td className="px-3 py-3 tabular-nums font-medium">
                      {formatPersianNumber(entry.ratingScore)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
