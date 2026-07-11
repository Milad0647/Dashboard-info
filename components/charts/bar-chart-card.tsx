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
import { formatPersianNumber, getStatusLabel } from "@/lib/utils";

interface BarChartCardProps {
  data: { label: string; value: number }[];
  title: string;
  color?: string;
}

function wrapLabel(label: string, maxChars = 24): string {
  const trimmed = label.trim();
  if (trimmed.length <= maxChars) return trimmed;

  const words = trimmed.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = word.length > maxChars ? `${word.slice(0, maxChars - 1)}…` : word;
  }
  if (current) lines.push(current);

  return lines.slice(0, 3).join("\n");
}

function MultiLineYTick({
  x,
  y,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value?: string };
}) {
  const lines = String(payload?.value ?? "").split("\n");
  const startY = (y ?? 0) - ((lines.length - 1) * 6);

  return (
    <g transform={`translate(${x},${startY})`}>
      {lines.map((line, index) => (
        <text
          key={`${line}-${index}`}
          x={0}
          y={index * 12}
          dy={4}
          textAnchor="end"
          fill="currentColor"
          fontSize={11}
        >
          {line}
        </text>
      ))}
    </g>
  );
}

export function BarChartCard({ data, title, color = "#2563eb" }: BarChartCardProps) {
  const chartData = data.map((d) => {
    const fullName = getStatusLabel(d.label) !== d.label ? getStatusLabel(d.label) : d.label;
    return {
      name: wrapLabel(fullName),
      fullName,
      value: d.value,
    };
  });

  const chartHeight = Math.max(280, chartData.length * 56 + 48);
  const yAxisWidth = Math.min(
    220,
    Math.max(
      120,
      ...chartData.map((item) =>
        Math.min(Math.max(...item.name.split("\n").map((line) => line.length * 9), 0), 220)
      )
    )
  );

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-hidden">
        {chartData.length === 0 ? (
          <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">
            داده‌ای برای نمایش وجود ندارد.
          </div>
        ) : (
          <div className="w-full min-w-0 overflow-x-hidden" style={{ height: chartHeight }} dir="ltr">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ left: 4, right: 16, top: 8, bottom: 8 }}
                barCategoryGap="24%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => formatPersianNumber(v)}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={<MultiLineYTick />}
                  width={yAxisWidth}
                  interval={0}
                />
                <Tooltip
                  formatter={(value: number) => formatPersianNumber(value)}
                  labelFormatter={(_, payload) => {
                    const fullName = payload?.[0]?.payload?.fullName;
                    return typeof fullName === "string" ? fullName : "";
                  }}
                />
                <Bar dataKey="value" fill={color} radius={[0, 4, 4, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
