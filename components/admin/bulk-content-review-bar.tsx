"use client";

import { useState } from "react";
import { BadgeCheck } from "lucide-react";
import { PlanLabelSelect } from "@/components/admin/plan-label-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ContentTopic } from "@/lib/content-topics";
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

export function BulkTopicEditPanel({
  selectedCount,
  contentTopics,
  contentPlans,
  pending,
  onApply,
}: {
  selectedCount: number;
  contentTopics?: ContentTopic[];
  contentPlans?: string[];
  pending: boolean;
  onApply: (planLabels: string[]) => void;
}) {
  const [changeTopic, setChangeTopic] = useState(false);
  const [planLabels, setPlanLabels] = useState<string[]>([]);

  if (selectedCount === 0) return null;

  return (
    <div className="w-full space-y-3 rounded-xl border bg-card p-3 sm:max-w-lg">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={changeTopic}
          onChange={(event) => setChangeTopic(event.target.checked)}
        />
        تغییر موضوع
      </label>
      {changeTopic && (
        <>
          <PlanLabelSelect
            topics={contentTopics}
            plans={contentPlans}
            values={planLabels}
            onChangeMultiple={setPlanLabels}
            label="موضوع جدید"
          />
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => onApply(planLabels)}
          >
            {pending
              ? "در حال اعمال..."
              : `اعمال موضوع روی ${formatPersianNumber(selectedCount)} مورد`}
          </Button>
        </>
      )}
    </div>
  );
}
