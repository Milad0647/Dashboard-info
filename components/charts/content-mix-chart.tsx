"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ContentMixItem } from "@/lib/campaign-overview-insights";
import { useChartTheme } from "@/lib/hooks/use-chart-theme";
import { formatPersianNumber } from "@/lib/utils";

const COLORS = ["#3b82f6", "#34d399", "#fbbf24", "#f87171", "#a78bfa", "#22d3ee", "#94a3b8"];

interface ContentMixChartProps {
  data: ContentMixItem[];
  title?: string;
}

export function ContentMixChart({ data, title = "ترکیب انواع محتوا" }: ContentMixChartProps) {
  const chartTheme = useChartTheme();
  const chartData = data.map((item) => ({
    name: item.label,
    count: item.count,
  }));

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
            داده‌ای برای نمایش وجود ندارد.
          </div>
        ) : (
          <div className="h-[280px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="count"
                  nameKey="name"
                >
                  {chartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => formatPersianNumber(value)}
                  contentStyle={chartTheme.tooltipContentStyle}
                  labelStyle={chartTheme.tooltipLabelStyle}
                />
                <Legend wrapperStyle={chartTheme.legendStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
