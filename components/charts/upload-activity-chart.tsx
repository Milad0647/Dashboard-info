"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { TodayUploadsModal } from "@/components/public/today-uploads-modal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useChartTheme } from "@/lib/hooks/use-chart-theme";
import type {
  TodayUploadListItem,
  UploadActivitySummary,
} from "@/lib/upload-activity-stats";
import { formatPersianDateShort, formatPersianNumber } from "@/lib/utils";

interface UploadActivityChartProps {
  stats: UploadActivitySummary;
  todayItems?: TodayUploadListItem[];
}

export function UploadActivityChart({
  stats,
  todayItems = [],
}: UploadActivityChartProps) {
  const chartTheme = useChartTheme();
  const [todayOpen, setTodayOpen] = useState(false);
  const chartData = stats.series.map((point) => ({
    ...point,
    label: formatPersianDateShort(point.date),
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <button
          type="button"
          className="apple-press rounded-xl text-right outline-none ring-offset-background transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setTodayOpen(true)}
          aria-label="مشاهده آپلودهای امروز"
        >
          <Card className="h-full cursor-pointer border-primary/30 py-3 hover:border-primary/60 hover:bg-muted/30">
            <CardContent className="px-4 py-0">
              <p className="text-xs text-muted-foreground">امروز</p>
              <p className="text-2xl font-bold">{formatPersianNumber(stats.today)}</p>
              <p className="mt-1 text-[10px] text-primary">برای مشاهده کلیک کنید</p>
            </CardContent>
          </Card>
        </button>
        <Card className="py-3">
          <CardContent className="px-4 py-0">
            <p className="text-xs text-muted-foreground">دیروز</p>
            <p className="text-2xl font-bold">{formatPersianNumber(stats.yesterday)}</p>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="px-4 py-0">
            <p className="text-xs text-muted-foreground">۷ روز اخیر</p>
            <p className="text-2xl font-bold">{formatPersianNumber(stats.last7Days)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">آپلود محتوا در طول زمان</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[260px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="uploadGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: chartTheme.tick }} />
                <YAxis
                  tick={{ fontSize: 11, fill: chartTheme.tick }}
                  allowDecimals={false}
                  tickFormatter={(v) => formatPersianNumber(v)}
                />
                <Tooltip
                  formatter={(value: number) => formatPersianNumber(value)}
                  labelFormatter={(label) => `تاریخ: ${label}`}
                  contentStyle={chartTheme.tooltipContentStyle}
                  labelStyle={chartTheme.tooltipLabelStyle}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="آپلود"
                  stroke="#3b82f6"
                  fill="url(#uploadGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <TodayUploadsModal open={todayOpen} onOpenChange={setTodayOpen} items={todayItems} />
    </div>
  );
}
