"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { BillboardCategoryStat } from "@/lib/billboard-categories";
import { cn, formatPersianNumber } from "@/lib/utils";

interface BillboardCategoryChartProps {
  data: BillboardCategoryStat[];
  title?: string;
  color?: string;
  selectedLabel?: string | null;
  onSelect?: (label: string) => void;
}

export function BillboardCategoryChart({
  data,
  selectedLabel = null,
  onSelect,
}: BillboardCategoryChartProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border bg-card py-8 text-center text-sm text-muted-foreground">
        داده‌ای برای نمایش وجود ندارد.
      </div>
    );
  }

  const isInteractive = typeof onSelect === "function";

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {data.map((item) => {
        const isSelected = selectedLabel === item.label;

        return (
          <Card
            key={item.label}
            role={isInteractive ? "button" : undefined}
            tabIndex={isInteractive ? 0 : undefined}
            aria-pressed={isInteractive ? isSelected : undefined}
            onClick={isInteractive ? () => onSelect(item.label) : undefined}
            onKeyDown={
              isInteractive
                ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(item.label);
                    }
                  }
                : undefined
            }
            className={cn(
              isInteractive &&
                "cursor-pointer transition-colors hover:border-primary/50 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isSelected && "border-primary bg-primary/5 ring-1 ring-primary/30"
            )}
          >
            <CardContent className="flex flex-col items-center justify-center gap-1 p-4 text-center">
              <p
                className={cn(
                  "text-sm leading-snug",
                  isSelected ? "font-medium text-foreground" : "text-muted-foreground"
                )}
              >
                {item.label}
              </p>
              <p className="text-2xl font-bold tabular-nums">
                {formatPersianNumber(item.count)}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
