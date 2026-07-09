"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, MapPin, Medal, Trophy, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChartCard } from "@/components/charts/bar-chart-card";
import { SectionHeader } from "@/components/public/section-header";
import {
  buildProvinceContributorLeaderboard,
  buildProvinceLeaderboard,
  buildUserLeaderboard,
  getProvinceRankBadge,
  type ProvinceLeaderboardEntry,
  type ProvinceLeaderboardMetrics,
  type UserLeaderboardEntry,
} from "@/lib/city-leaderboard";
import type { PublicCampaignData } from "@/lib/types";
import { formatPersianDate, formatPersianNumber } from "@/lib/utils";

type LeaderboardView = "province" | "user";

interface CityLeaderboardDashboardProps {
  data: PublicCampaignData;
  slug: string;
}

function MetricsBreakdown({ entry }: { entry: ProvinceLeaderboardMetrics }) {
  const items = [
    { label: "بیلبورد", value: entry.billboards },
    { label: "پوستر", value: entry.posters },
    { label: "ویدیو", value: entry.videos },
    { label: "شبکه اجتماعی", value: entry.socialPosts },
    { label: "انتشار سایت", value: entry.sitePublications },
    { label: "اقدام", value: entry.activities },
    { label: "فایل", value: entry.files },
  ].filter((item) => item.value > 0);

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

function ProvincePodiumCard({ entry }: { entry: ProvinceLeaderboardEntry }) {
  const heightClass =
    entry.rank === 1 ? "min-h-[220px]" : entry.rank === 2 ? "min-h-[190px]" : "min-h-[170px]";

  return (
    <Card className={`${heightClass} flex flex-col justify-end border-primary/20 bg-gradient-to-b from-primary/5 to-card`}>
      <CardContent className="space-y-3 p-5 text-center">
        <div className="text-3xl">{getProvinceRankBadge(entry.rank)}</div>
        <p className="font-bold">{entry.province}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Badge variant="secondary">{formatPersianNumber(entry.score)} امتیاز</Badge>
          <Badge variant="outline">{formatPersianNumber(entry.totalUploads)} محتوا</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function UserPodiumCard({ entry }: { entry: UserLeaderboardEntry }) {
  const heightClass =
    entry.rank === 1 ? "min-h-[220px]" : entry.rank === 2 ? "min-h-[190px]" : "min-h-[170px]";

  return (
    <Card className={`${heightClass} flex flex-col justify-end border-primary/20 bg-gradient-to-b from-primary/5 to-card`}>
      <CardContent className="space-y-3 p-5 text-center">
        <div className="text-3xl">{getProvinceRankBadge(entry.rank)}</div>
        <p className="font-bold">{entry.userName}</p>
        <p className="text-xs text-muted-foreground">{entry.province}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Badge variant="secondary">{formatPersianNumber(entry.score)} امتیاز</Badge>
          <Badge variant="outline">{formatPersianNumber(entry.totalUploads)} محتوا</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function LeaderboardViewToggle({
  view,
  onChange,
}: {
  view: LeaderboardView;
  onChange: (view: LeaderboardView) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        size="sm"
        variant={view === "province" ? "default" : "outline"}
        onClick={() => onChange("province")}
      >
        <MapPin className="h-4 w-4" />
        بر اساس استان
      </Button>
      <Button
        type="button"
        size="sm"
        variant={view === "user" ? "default" : "outline"}
        onClick={() => onChange("user")}
      >
        <Users className="h-4 w-4" />
        بر اساس کاربر
      </Button>
    </div>
  );
}

export function CityLeaderboardDashboard({ data, slug }: CityLeaderboardDashboardProps) {
  const { settings } = data;
  const [view, setView] = useState<LeaderboardView>("province");

  const provinces = useMemo(() => buildProvinceLeaderboard(data), [data]);
  const users = useMemo(() => buildUserLeaderboard(data), [data]);
  const contributors = useMemo(() => buildProvinceContributorLeaderboard(data), [data]);

  const activeEntries = view === "province" ? provinces : users;

  const chartData = useMemo(
    () =>
      (view === "province" ? provinces : users).slice(0, 10).map((entry) => ({
        label: view === "province" ? entry.province : (entry as UserLeaderboardEntry).userName,
        value: entry.score,
      })),
    [provinces, users, view]
  );

  const uploadChartData = useMemo(
    () =>
      (view === "province" ? provinces : users).slice(0, 10).map((entry) => ({
        label: view === "province" ? entry.province : (entry as UserLeaderboardEntry).userName,
        value: entry.totalUploads,
      })),
    [provinces, users, view]
  );

  const podium = activeEntries.slice(0, 3);
  const orderedPodium = podium.length === 3 ? [podium[1], podium[0], podium[2]] : podium;

  const isProvinceView = view === "province";

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-4">
          <div>
            <Link
              href={`/campaign/${slug}`}
              className="mb-1 flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowRight className="h-3 w-3" />
              بازگشت به گزارش کمپین
            </Link>
            <h1 className="text-lg font-bold">
              {isProvinceView ? "رتبه‌بندی استان‌ها" : "رتبه‌بندی کاربران"}
            </h1>
            <p className="text-sm text-muted-foreground">{settings.title}</p>
          </div>
          <Badge variant="outline" className="gap-1">
            <Trophy className="h-3.5 w-3.5" />
            {formatPersianNumber(activeEntries.length)} {isProvinceView ? "استان" : "کاربر"}
          </Badge>
        </div>
      </header>

      <main className="container mx-auto max-w-[1280px] space-y-8 px-4 py-8">
        <SectionHeader
          title={isProvinceView ? "مقایسه عملکرد استان‌ها" : "مقایسه عملکرد کاربران"}
          description={
            isProvinceView
              ? "رتبه‌بندی استان‌ها بر اساس امتیاز فعالیت کاربران و حجم محتوای ثبت‌شده"
              : "رتبه‌بندی کاربران بر اساس امتیاز فعالیت و حجم محتوای ثبت‌شده"
          }
        >
          <Badge status={settings.status}>
            {settings.status === "live" ? "زنده" : settings.status === "completed" ? "پایان‌یافته" : "پیش‌نویس"}
          </Badge>
        </SectionHeader>

        <LeaderboardViewToggle view={view} onChange={setView} />

        <p className="text-sm text-muted-foreground">
          {formatPersianDate(settings.startDate)} — {formatPersianDate(settings.endDate)}
        </p>

        {activeEntries.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {isProvinceView
                ? "هنوز داده‌ای برای مقایسه استان‌ها ثبت نشده است."
                : "هنوز داده‌ای برای مقایسه کاربران ثبت نشده است."}
            </CardContent>
          </Card>
        ) : (
          <>
            {podium.length > 0 && (
              <section className="space-y-4">
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <Medal className="h-5 w-5 text-primary" />
                  {isProvinceView ? "سکوی برترین استان‌ها" : "سکوی برترین کاربران"}
                </h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {orderedPodium.map((entry) =>
                    isProvinceView ? (
                      <ProvincePodiumCard
                        key={(entry as ProvinceLeaderboardEntry).provinceKey}
                        entry={entry as ProvinceLeaderboardEntry}
                      />
                    ) : (
                      <UserPodiumCard
                        key={(entry as UserLeaderboardEntry).userKey}
                        entry={entry as UserLeaderboardEntry}
                      />
                    )
                  )}
                </div>
              </section>
            )}

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <BarChartCard
                data={chartData}
                title={isProvinceView ? "امتیاز استان‌ها (۱۰ استان برتر)" : "امتیاز کاربران (۱۰ نفر برتر)"}
                color="#2563eb"
              />
              <BarChartCard data={uploadChartData} title="تعداد محتوای ثبت‌شده" color="#16a34a" />
            </div>

            <section className="space-y-4">
              <h2 className="text-base font-semibold">
                {isProvinceView ? "جدول رتبه‌بندی استان‌ها" : "جدول رتبه‌بندی کاربران"}
              </h2>
              <div className="space-y-3">
                {activeEntries.map((entry) => (
                  <Card key={isProvinceView ? (entry as ProvinceLeaderboardEntry).provinceKey : (entry as UserLeaderboardEntry).userKey}>
                    <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-lg">{getProvinceRankBadge(entry.rank)}</span>
                          <p className="font-semibold">
                            {isProvinceView
                              ? (entry as ProvinceLeaderboardEntry).province
                              : (entry as UserLeaderboardEntry).userName}
                          </p>
                          {!isProvinceView && (
                            <span className="text-sm text-muted-foreground">
                              — {(entry as UserLeaderboardEntry).province}
                            </span>
                          )}
                          {entry.todayUploads > 0 && (
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                              +{formatPersianNumber(entry.todayUploads)} امروز
                            </Badge>
                          )}
                        </div>
                        <MetricsBreakdown entry={entry} />
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <Badge variant="secondary">{formatPersianNumber(entry.score)} امتیاز</Badge>
                        <Badge variant="outline">{formatPersianNumber(entry.totalUploads)} محتوا</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            {isProvinceView && (
              <section className="space-y-4">
                <h2 className="text-base font-semibold">برترین کاربران در هر استان</h2>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {contributors.slice(0, 12).map((contributor) => (
                    <Card key={`${contributor.provinceKey}-${contributor.userName}-${contributor.rank}`}>
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center justify-between gap-2 text-sm">
                          <span>{contributor.userName}</span>
                          <span>{getProvinceRankBadge(contributor.rank)}</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm text-muted-foreground">
                        <p>{contributor.province}</p>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">{formatPersianNumber(contributor.score)} امتیاز</Badge>
                          <Badge variant="secondary">
                            {formatPersianNumber(contributor.totalUploads)} محتوا
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
