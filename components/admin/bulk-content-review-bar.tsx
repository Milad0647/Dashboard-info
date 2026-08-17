"use client";

import { BadgeCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPersianNumber } from "@/lib/utils";

export function BulkContentReviewActions({
  selectedCount,
  approveCount,
  rejectCount,
  pending,
  onApprove,
  onReject,
}: {
  selectedCount: number;
  approveCount: number;
  rejectCount: number;
  pending: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  if (selectedCount === 0) return null;

  return (
    <>
      <Badge variant="secondary">{formatPersianNumber(selectedCount)} انتخاب‌شده</Badge>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="gap-1.5"
        disabled={pending || approveCount === 0}
        onClick={onApprove}
      >
        <BadgeCheck className="h-4 w-4" />
        تایید گروهی ({formatPersianNumber(approveCount)})
      </Button>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        disabled={pending || rejectCount === 0}
        onClick={onReject}
      >
        رد گروهی ({formatPersianNumber(rejectCount)})
      </Button>
    </>
  );
}
