"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useChartTheme } from "@/lib/hooks/use-chart-theme";
import { formatPersianDateShort, formatPersianNumber } from "@/lib/utils";

interface VisitsLineChartProps {
  data: { date: string; visitors: number; pageViews: number }[];
}

export function VisitsLineChart({ data }: VisitsLineChartProps) {
  const chartTheme = useChartTheme();
  const chartData = data.map((d) => ({
    ...d,
    label: formatPersianDateShort(d.date),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">بازدید در طول زمان</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: chartTheme.tick }} />
              <YAxis
                tick={{ fontSize: 12, fill: chartTheme.tick }}
                tickFormatter={(v) => formatPersianNumber(v)}
              />
              <Tooltip
                formatter={(value: number) => formatPersianNumber(value)}
                labelFormatter={(label) => `تاریخ: ${label}`}
                contentStyle={chartTheme.tooltipContentStyle}
                labelStyle={chartTheme.tooltipLabelStyle}
              />
              <Legend wrapperStyle={chartTheme.legendStyle} />
              <Line
                type="monotone"
                dataKey="visitors"
                name="بازدیدکنندگان"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="pageViews"
                name="بازدید صفحات"
                stroke="#34d399"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
