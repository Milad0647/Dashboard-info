"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, Medal, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChartCard } from "@/components/charts/bar-chart-card";
import { SectionHeader } from "@/components/public/section-header";
import {
  buildCityContributorLeaderboard,
  buildCityLeaderboard,
  getCityRankBadge,
  type CityLeaderboardEntry,
} from "@/lib/city-leaderboard";
import type { PublicCampaignData } from "@/lib/types";
import { formatPersianDate, formatPersianNumber } from "@/lib/utils";

interface CityLeaderboardDashboardProps {
  data: PublicCampaignData;
  slug: string;
}

function PodiumCard({ entry }: { entry: CityLeaderboardEntry }) {
  const heightClass =
    entry.rank === 1 ? "min-h-[220px]" : entry.rank === 2 ? "min-h-[190px]" : "min-h-[170px]";

  return (
    <Card className={`${heightClass} flex flex-col justify-end border-primary/20 bg-gradient-to-b from-primary/5 to-card`}>
      <CardContent className="space-y-3 p-5 text-center">
        <div className="text-3xl">{getCityRankBadge(entry.rank)}</div>
        <div>
          <p className="font-bold">{entry.city}</p>
          <p className="text-xs text-muted-foreground">{entry.province}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Badge variant="secondary">{formatPersianNumber(entry.score)} امتیاز</Badge>
          <Badge variant="outline">{formatPersianNumber(entry.totalUploads)} محتوا</Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function CityBreakdown({ entry }: { entry: CityLeaderboardEntry }) {
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

export function CityLeaderboardDashboard({ data, slug }: CityLeaderboardDashboardProps) {
  const { settings } = data;

  const cities = useMemo(() => buildCityLeaderboard(data), [data]);
  const contributors = useMemo(() => buildCityContributorLeaderboard(data), [data]);

  const chartData = useMemo(
    () =>
      cities.slice(0, 10).map((city) => ({
        label: city.city,
        value: city.score,
      })),
    [cities]
  );

  const uploadChartData = useMemo(
    () =>
      cities.slice(0, 10).map((city) => ({
        label: city.city,
        value: city.totalUploads,
      })),
    [cities]
  );

  const podium = cities.slice(0, 3);
  const orderedPodium = podium.length === 3 ? [podium[1], podium[0], podium[2]] : podium;

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
            <h1 className="text-lg font-bold">رتبه‌بندی شهرها</h1>
            <p className="text-sm text-muted-foreground">{settings.title}</p>
          </div>
          <Badge variant="outline" className="gap-1">
            <Trophy className="h-3.5 w-3.5" />
            {formatPersianNumber(cities.length)} شهر
          </Badge>
        </div>
      </header>

      <main className="container mx-auto max-w-[1280px] space-y-8 px-4 py-8">
        <SectionHeader
          title="مقایسه عملکرد شهرها"
          description="رتبه‌بندی شهرها بر اساس امتیاز فعالیت کاربران و حجم محتوای ثبت‌شده"
        >
          <Badge status={settings.status}>
            {settings.status === "live" ? "زنده" : settings.status === "completed" ? "پایان‌یافته" : "پیش‌نویس"}
          </Badge>
        </SectionHeader>

        <p className="text-sm text-muted-foreground">
          {formatPersianDate(settings.startDate)} — {formatPersianDate(settings.endDate)}
        </p>

        {cities.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              هنوز داده‌ای برای مقایسه شهرها ثبت نشده است.
            </CardContent>
          </Card>
        ) : (
          <>
            {podium.length > 0 && (
              <section className="space-y-4">
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <Medal className="h-5 w-5 text-primary" />
                  سکوی برترین شهرها
                </h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {orderedPodium.map((entry) => (
                    <PodiumCard key={entry.cityKey} entry={entry} />
                  ))}
                </div>
              </section>
            )}

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <BarChartCard data={chartData} title="امتیاز شهرها (۱۰ شهر برتر)" color="#2563eb" />
              <BarChartCard data={uploadChartData} title="تعداد محتوای ثبت‌شده" color="#16a34a" />
            </div>

            <section className="space-y-4">
              <h2 className="text-base font-semibold">جدول رتبه‌بندی شهرها</h2>
              <div className="space-y-3">
                {cities.map((entry) => (
                  <Card key={entry.cityKey}>
                    <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-lg">{getCityRankBadge(entry.rank)}</span>
                          <p className="font-semibold">
                            {entry.city} — {entry.province}
                          </p>
                          {entry.todayUploads > 0 && (
                            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                              +{formatPersianNumber(entry.todayUploads)} امروز
                            </Badge>
                          )}
                        </div>
                        <CityBreakdown entry={entry} />
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

            <section className="space-y-4">
              <h2 className="text-base font-semibold">برترین کاربران در هر شهر</h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {contributors.slice(0, 12).map((contributor) => (
                  <Card key={`${contributor.cityKey}-${contributor.userName}-${contributor.rank}`}>
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center justify-between gap-2 text-sm">
                        <span>{contributor.userName}</span>
                        <span>{getCityRankBadge(contributor.rank)}</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm text-muted-foreground">
                      <p>
                        {contributor.city} — {contributor.province}
                      </p>
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
          </>
        )}
      </main>
    </div>
  );
}
