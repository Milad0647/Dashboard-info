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
import { formatPersianDateShort, formatPersianNumber } from "@/lib/utils";

interface VisitsLineChartProps {
  data: { date: string; visitors: number; pageViews: number }[];
}

export function VisitsLineChart({ data }: VisitsLineChartProps) {
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
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatPersianNumber(v)} />
              <Tooltip
                formatter={(value: number) => formatPersianNumber(value)}
                labelFormatter={(label) => `تاریخ: ${label}`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="visitors"
                name="بازدیدکنندگان"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="pageViews"
                name="بازدید صفحات"
                stroke="#16a34a"
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
