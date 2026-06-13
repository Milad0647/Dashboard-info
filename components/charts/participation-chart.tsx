"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPersianDateShort, formatPersianNumber } from "@/lib/utils";

interface ParticipationChartProps {
  data: { date: string; count: number }[];
}

export function ParticipationChart({ data }: ParticipationChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    label: formatPersianDateShort(d.date),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">مشارکت بر اساس تاریخ</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[260px] w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => formatPersianNumber(v)} />
              <Tooltip formatter={(value: number) => formatPersianNumber(value)} />
              <Bar dataKey="count" name="مشارکت" fill="#7c3aed" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
