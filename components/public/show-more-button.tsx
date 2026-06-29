"use client";

import { formatPersianNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface ShowMoreButtonProps {
  remaining: number;
  onClick: () => void;
  label?: string;
}

export function ShowMoreButton({
  remaining,
  onClick,
  label = "مشاهده بیشتر",
}: ShowMoreButtonProps) {
  if (remaining <= 0) return null;

  return (
    <div className="flex justify-center" data-export-hide>
      <Button variant="outline" onClick={onClick}>
        {label} ({formatPersianNumber(remaining)} باقی‌مانده)
      </Button>
    </div>
  );
}
