"use client";

import { BarChartCard } from "@/components/charts/bar-chart-card";
import type { BillboardCategoryStat } from "@/lib/billboard-categories";

interface BillboardCategoryChartProps {
  data: BillboardCategoryStat[];
  title?: string;
  color?: string;
}

export function BillboardCategoryChart({
  data,
  title = "تفکیک دسته تبلیغات محیطی",
  color = "#0ea5e9",
}: BillboardCategoryChartProps) {
  return (
    <BarChartCard
      title={title}
      color={color}
      data={data.map((item) => ({ label: item.label, value: item.count }))}
    />
  );
}
