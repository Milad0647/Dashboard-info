"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Building2,
  CalendarRange,
  Download,
  LayoutList,
  MapPin,
  RotateCcw,
  Search,
  Star,
  Table2,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PersianDateInput } from "@/components/ui/persian-date-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  buildUserLeaderboard,
  buildUserRatingLeaderboard,
  getProvinceRankBadge,
  type LeaderboardSourceData,
  type UserLeaderboardEntry,
} from "@/lib/city-leaderboard";
import { formatPlanLabelDisplay } from "@/lib/content-topics";
import type { CampaignDatePreset } from "@/lib/owner-location-filter";
import {
  DEFAULT_PERFORMANCE_LEADERBOARD_FILTER,
  OWNER_COMPANY_TYPE_ALL,
  OWNER_DATE_ALL,
  OWNER_LOCATION_ALL,
  PERFORMANCE_CONTENT_CATEGORY_OPTIONS,
  collectPerformanceFilterOptions,
  filterLeaderboardSourceForPerformance,
  getPerformancePeriodLabel,
  isPerformanceLeaderboardFilterActive,
  appendPerformanceFilterParams,
  type PerformanceContentCategory,
  type PerformanceLeaderboardFilter,
  type PerformanceRegionFilter,
} from "@/lib/performance-filters";
import { downloadPerformanceExcel } from "@/lib/services/performance-excel-export";
import {
  USER_COMPANY_TYPES,
  getUserCompanyTypeLabel,
  type UserCompanyType,
} from "@/lib/user-company-types";
import { USER_REGIONS, getUserRegionLabel } from "@/lib/user-regions";
import { formatPersianNumber } from "@/lib/utils";

type SortMode = "activity" | "rating";
type ViewMode = "cards" | "table";

interface PerformanceAdminProps {
  source: LeaderboardSourceData;
  campaignId: string;
  campaignTitle: string;
  campaignSlug: string;
  contentPlans?: string[];
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

function companySupervisionHref(
  campaignId: string,
  userKey: string,
  filter: PerformanceLeaderboardFilter
): string {
  const params = new URLSearchParams({ campaign: campaignId });
  appendPerformanceFilterParams(params, filter);
  return `/admin/performance/user/${encodeURIComponent(userKey)}?${params.toString()}`;
}

export function PerformanceAdmin({
  source,
  campaignId,
  campaignTitle,
  campaignSlug,
  contentPlans = [],
}: PerformanceAdminProps) {
  const [sortMode, setSortMode] = useState<SortMode>("activity");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<PerformanceLeaderboardFilter>(
    DEFAULT_PERFORMANCE_LEADERBOARD_FILTER
  );

  const options = useMemo(() => collectPerformanceFilterOptions(source), [source]);
  const planOptionsSource = contentPlans.length > 0 ? contentPlans : options.planLabels;
  const cities =
    filter.province === OWNER_LOCATION_ALL
      ? []
      : (options.citiesByProvince[filter.province] ?? []);
  const filterActive = isPerformanceLeaderboardFilterActive(filter);
  const periodLabel = getPerformancePeriodLabel(filter);

  const rankedEntries = useMemo(() => {
    const filteredSource = filterLeaderboardSourceForPerformance(source, filter);
    return sortMode === "rating"
      ? buildUserRatingLeaderboard(filteredSource)
      : buildUserLeaderboard(filteredSource);
  }, [source, filter, sortMode]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rankedEntries;
    return rankedEntries.filter((entry) => {
      return (
        entry.userName.toLowerCase().includes(query) ||
        entry.province.toLowerCase().includes(query) ||
        entry.city.toLowerCase().includes(query)
      );
    });
  }, [rankedEntries, search]);

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

  const updateFilter = (patch: Partial<PerformanceLeaderboardFilter>) => {
    setFilter((current) => {
      const next = { ...current, ...patch };
      if (patch.province !== undefined && patch.province !== current.province) {
        next.city = OWNER_LOCATION_ALL;
      }
      return next;
    });
  };

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

  const provinceOptions = [
    { value: OWNER_LOCATION_ALL, label: "همه استان‌ها" },
    ...options.provinces.map((province) => ({ value: province, label: province })),
  ];
  const cityOptions = [
    { value: OWNER_LOCATION_ALL, label: "همه شهرها" },
    ...cities.map((city) => ({ value: city, label: city })),
  ];
  const companyTypeOptions = [
    { value: OWNER_COMPANY_TYPE_ALL, label: "همه انواع شرکت" },
    ...USER_COMPANY_TYPES.map((companyType) => ({
      value: companyType,
      label: getUserCompanyTypeLabel(companyType),
    })),
  ];
  const regionOptions = [
    { value: OWNER_LOCATION_ALL, label: "همه مناطق" },
    ...USER_REGIONS.map((region) => ({
      value: region,
      label: getUserRegionLabel(region),
    })),
  ];
  const planSelectOptions = planOptionsSource
    .filter((plan) => !filter.planLabels.includes(plan))
    .map((plan) => ({
      value: plan,
      label: formatPlanLabelDisplay(plan),
      keywords: plan,
    }));

  return (
    <div className="space-y-6 text-right" dir="rtl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">مشاهده عملکرد</h1>
          <p className="text-sm text-muted-foreground">
            نمای مدیریتی از آمار عددی همه کاربران کمپین «{campaignTitle}» — رتبه با فیلترهای
            انتخاب‌شده دوباره محاسبه می‌شود
          </p>
        </div>
        <Button type="button" onClick={handleExport} className="shrink-0 gap-2">
          <Download className="h-4 w-4" />
          خروجی اکسل
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryStat label="تعداد کاربران" value={totals.users} />
        <SummaryStat
          label={periodLabel ? `جمع محتوا (${periodLabel})` : "جمع محتوا"}
          value={totals.content}
        />
        <SummaryStat
          label={
            periodLabel
              ? sortMode === "rating"
                ? `امتیاز محتوا (${periodLabel})`
                : `امتیاز فعالیت (${periodLabel})`
              : sortMode === "rating"
                ? "جمع امتیاز محتوا"
                : "جمع امتیاز فعالیت"
          }
          value={totals.score}
        />
        <SummaryStat label="محتوای امروز" value={totals.today} />
      </div>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <MapPin className="h-4 w-4 shrink-0 text-primary" />
              فیلتر رتبه‌بندی
              {filterActive ? (
                <Badge variant="secondary">
                  {periodLabel
                    ? `رتبه، تعداد و امتیاز بر اساس ${periodLabel}`
                    : "رتبه بر اساس فیلتر فعلی"}
                </Badge>
              ) : null}
            </div>
            {filterActive ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setFilter(DEFAULT_PERFORMANCE_LEADERBOARD_FILTER)}
              >
                <RotateCcw className="h-4 w-4" />
                پاک کردن فیلترها
              </Button>
            ) : null}
          </div>

          <div className="relative w-full max-w-md">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="جستجوی نام شرکت، استان یا شهر..."
              className="pr-9"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SearchableSelect
              value={filter.province}
              onValueChange={(province) => updateFilter({ province })}
              options={provinceOptions}
              placeholder="استان"
              searchPlaceholder="جستجوی استان..."
            />
            <SearchableSelect
              value={filter.city}
              onValueChange={(city) => updateFilter({ city })}
              options={cityOptions}
              placeholder={
                filter.province === OWNER_LOCATION_ALL ? "ابتدا استان را انتخاب کنید" : "شهر"
              }
              searchPlaceholder="جستجوی شهر..."
              disabled={filter.province === OWNER_LOCATION_ALL}
            />
            <SearchableSelect
              value={filter.companyType}
              onValueChange={(companyType) =>
                updateFilter({ companyType: companyType as UserCompanyType | "all" })
              }
              options={companyTypeOptions}
              placeholder="نوع شرکت"
              searchPlaceholder="جستجوی نوع شرکت..."
              leadingIcon={<Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />}
            />
            <SearchableSelect
              value={filter.region}
              onValueChange={(region) =>
                updateFilter({ region: region as PerformanceRegionFilter })
              }
              options={regionOptions}
              placeholder="دسته‌بندی منطقه‌ای"
              searchPlaceholder="جستجوی منطقه..."
            />
            <Select
              value={filter.contentCategory}
              onValueChange={(value) =>
                updateFilter({ contentCategory: value as PerformanceContentCategory })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="دسته محتوا" />
              </SelectTrigger>
              <SelectContent dir="rtl">
                {PERFORMANCE_CONTENT_CATEGORY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filter.datePreset}
              onValueChange={(value) =>
                updateFilter({ datePreset: value as CampaignDatePreset })
              }
            >
              <SelectTrigger className="w-full">
                <div className="flex items-center gap-2">
                  <CalendarRange className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <SelectValue placeholder="تاریخ و روز" />
                </div>
              </SelectTrigger>
              <SelectContent dir="rtl">
                <SelectItem value={OWNER_DATE_ALL}>همه زمان‌ها</SelectItem>
                <SelectItem value="today">امروز</SelectItem>
                <SelectItem value="this_week">۷ روز اخیر</SelectItem>
                <SelectItem value="this_month">۳۰ روز اخیر</SelectItem>
                <SelectItem value="custom">تاریخ دستی</SelectItem>
              </SelectContent>
            </Select>
            {planOptionsSource.length > 0 ? (
              <SearchableSelect
                key={filter.planLabels.join("|")}
                value=""
                onValueChange={(value) => {
                  if (!filter.planLabels.includes(value)) {
                    updateFilter({ planLabels: [...filter.planLabels, value] });
                  }
                }}
                options={planSelectOptions}
                placeholder="افزودن موضوع"
                searchPlaceholder="جستجوی موضوع..."
                clearAfterSelect
                emptyText="موضوعی برای افزودن نیست"
              />
            ) : null}
          </div>

          {filter.planLabels.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">موضوع‌های انتخاب‌شده:</span>
              {filter.planLabels.map((label) => (
                <Badge key={label} variant="secondary" className="gap-1 pl-1">
                  {formatPlanLabelDisplay(label)}
                  <button
                    type="button"
                    className="rounded-sm p-0.5 hover:bg-muted"
                    onClick={() =>
                      updateFilter({
                        planLabels: filter.planLabels.filter((item) => item !== label),
                      })
                    }
                    aria-label={`حذف ${label}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => updateFilter({ planLabels: [] })}
              >
                پاک کردن موضوع‌ها
              </Button>
            </div>
          ) : null}

          {filter.datePreset === "custom" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">از تاریخ</label>
                <PersianDateInput
                  value={filter.dateFrom}
                  onChange={(dateFrom) => updateFilter({ dateFrom })}
                  allowEmpty
                  placeholder="از تاریخ"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">تا تاریخ</label>
                <PersianDateInput
                  value={filter.dateTo}
                  onChange={(dateTo) => updateFilter({ dateTo })}
                  allowEmpty
                  placeholder="تا تاریخ"
                />
              </div>
            </div>
          ) : null}

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
            const href = companySupervisionHref(campaignId, entry.userKey, filter);
            return (
              <Link
                key={entry.userKey}
                href={href}
                className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card className="transition-colors hover:border-primary/40">
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg">{getProvinceRankBadge(entry.rank)}</span>
                        <p className="font-semibold">{entry.userName}</p>
                        <span className="text-sm text-muted-foreground">
                          — {entry.province}
                          {entry.city && entry.city !== "نامشخص" ? `، ${entry.city}` : ""}
                        </span>
                        {entry.companyType ? (
                          <Badge variant="outline">
                            {getUserCompanyTypeLabel(entry.companyType)}
                          </Badge>
                        ) : null}
                        {entry.region ? (
                          <Badge variant="outline">{getUserRegionLabel(entry.region)}</Badge>
                        ) : null}
                        {entry.todayUploads > 0 && (
                          <Badge className="bg-success/15 text-success hover:bg-success/20">
                            +{formatPersianNumber(entry.todayUploads)} امروز
                          </Badge>
                        )}
                      </div>
                      <MetricsBreakdown entry={entry} />
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Badge variant="secondary">
                        {formatPersianNumber(scoreValue)}{" "}
                        {sortMode === "rating" ? "امتیاز محتوا" : "امتیاز"}
                        {periodLabel ? ` ${periodLabel}` : ""}
                      </Badge>
                      <Badge variant="outline">
                        {formatPersianNumber(entry.totalUploads)} محتوا
                        {periodLabel ? ` ${periodLabel}` : ""}
                      </Badge>
                      {(entry.pendingScore ?? 0) > 0 && (
                        <Badge variant="outline" className="text-amber-700 dark:text-amber-400">
                          {formatPersianNumber(entry.pendingScore)} در انتظار
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-primary">
                        نظارت شرکت
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">جدول عملکرد کاربران</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[1380px] border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-muted-foreground">
                  <th className="px-3 py-3 text-right font-medium">رتبه</th>
                  <th className="px-3 py-3 text-right font-medium">کاربر</th>
                  <th className="px-3 py-3 text-right font-medium">استان</th>
                  <th className="px-3 py-3 text-right font-medium">شهر</th>
                  <th className="px-3 py-3 text-right font-medium">نوع شرکت</th>
                  <th className="px-3 py-3 text-right font-medium">منطقه</th>
                  {METRIC_COLUMNS.map((column) => (
                    <th key={column.key} className="px-3 py-3 text-right font-medium">
                      {column.label}
                    </th>
                  ))}
                  <th className="px-3 py-3 text-right font-medium">محتوا</th>
                  <th className="px-3 py-3 text-right font-medium">امتیاز فعالیت</th>
                  <th className="px-3 py-3 text-right font-medium">امتیاز محتوا</th>
                  <th className="px-3 py-3 text-right font-medium">در انتظار</th>
                  <th className="px-3 py-3 text-right font-medium">نظارت</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => (
                  <tr key={entry.userKey} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-3 tabular-nums">{getProvinceRankBadge(entry.rank)}</td>
                    <td className="px-3 py-3 font-medium">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={companySupervisionHref(campaignId, entry.userKey, filter)}
                          className="text-primary hover:underline"
                        >
                          {entry.userName}
                        </Link>
                        {entry.todayUploads > 0 && (
                          <Badge className="bg-success/15 text-success hover:bg-success/20">
                            +{formatPersianNumber(entry.todayUploads)} امروز
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">{entry.province}</td>
                    <td className="px-3 py-3 text-muted-foreground">{entry.city}</td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {getUserCompanyTypeLabel(entry.companyType)}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {getUserRegionLabel(entry.region)}
                    </td>
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
                    <td className="px-3 py-3 tabular-nums font-medium text-amber-700 dark:text-amber-400">
                      {formatPersianNumber(entry.pendingScore ?? 0)}
                    </td>
                    <td className="px-3 py-3">
                      <Button type="button" size="sm" variant="outline" asChild>
                        <Link href={companySupervisionHref(campaignId, entry.userKey, filter)}>
                          باز کردن
                        </Link>
                      </Button>
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
