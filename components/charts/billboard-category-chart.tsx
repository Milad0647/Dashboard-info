"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { BillboardCategoryStat } from "@/lib/billboard-categories";
import { formatPersianNumber } from "@/lib/utils";

interface BillboardCategoryChartProps {
  data: BillboardCategoryStat[];
  title?: string;
  color?: string;
}

export function BillboardCategoryChart({
  data,
}: BillboardCategoryChartProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border bg-card py-8 text-center text-sm text-muted-foreground">
        داده‌ای برای نمایش وجود ندارد.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {data.map((item) => (
        <Card key={item.label}>
          <CardContent className="flex flex-col items-center justify-center gap-1 p-4 text-center">
            <p className="text-sm text-muted-foreground leading-snug">{item.label}</p>
            <p className="text-2xl font-bold tabular-nums">
              {formatPersianNumber(item.count)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
