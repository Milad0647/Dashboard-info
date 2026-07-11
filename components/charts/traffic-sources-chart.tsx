"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useChartTheme } from "@/lib/hooks/use-chart-theme";
import { formatPersianNumber, getStatusLabel } from "@/lib/utils";

const COLORS = ["#3b82f6", "#34d399", "#fbbf24", "#f87171", "#a78bfa", "#94a3b8"];

interface TrafficSourcesChartProps {
  data: { source: string; count: number }[];
  title?: string;
}

export function TrafficSourcesChart({ data, title = "منابع ترافیک" }: TrafficSourcesChartProps) {
  const chartTheme = useChartTheme();
  const chartData = data.map((d) => ({
    ...d,
    name: getStatusLabel(d.source),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  );
}
