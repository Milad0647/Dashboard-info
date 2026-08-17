"use client";

import { useMemo } from "react";
import { computeContentScore } from "@/lib/scoring/compute-content-score";
import { normalizeScoringRules } from "@/lib/scoring/normalize-scoring-rules";
import {
  getScoreableField,
  SCOREABLE_CONTENT_TYPE_LABELS,
} from "@/lib/scoring/scoreable-fields";
import type { CampaignScoringConfig, ScoreableContentType } from "@/lib/types";
import { formatPersianNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface LiveScorePanelProps {
  contentType: ScoreableContentType;
  values: Record<string, unknown>;
  scoringRules?: CampaignScoringConfig | null;
  everRejected?: boolean;
  className?: string;
  /** Compact strip for tight form layouts */
  compact?: boolean;
}

export function LiveScorePanel({
  contentType,
  values,
  scoringRules,
  everRejected = false,
  className,
  compact = false,
}: LiveScorePanelProps) {
  const config = useMemo(
    () => normalizeScoringRules(scoringRules ?? {}),
    [scoringRules]
  );

  const result = useMemo(
    () => computeContentScore(contentType, values, config),
    [contentType, values, config]
  );

  const afterApproval = everRejected ? result.autoScore * 0.5 : result.autoScore;
  const matched = result.breakdown.filter((b) => b.matched && b.points > 0);

  return (
    <div
      className={cn(
        "rounded-xl border border-border/80 bg-muted/40",
        compact ? "p-3" : "p-4",
        className
      )}
      dir="rtl"
    >
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">
            پیش‌نمایش امتیاز · {SCOREABLE_CONTENT_TYPE_LABELS[contentType]}
          </p>
          <p className={cn("font-semibold tabular-nums", compact ? "text-xl" : "text-2xl")}>
            {formatPersianNumber(result.autoScore)}
            <span className="text-sm font-normal text-muted-foreground mr-1">امتیاز</span>
          </p>
        </div>
        {everRejected && (
          <p className="text-xs text-amber-700 dark:text-amber-400 text-left max-w-[12rem]">
            به‌خاطر برگشت قبلی، بعد از تأیید{" "}
            {formatPersianNumber(afterApproval)} امتیاز ثبت می‌شود
          </p>
        )}
      </div>

      {!compact && matched.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-border/60 pt-3">
          {matched.map((entry) => (
            <li
              key={`${entry.ruleId}-${entry.field}`}
              className="flex items-center justify-between text-sm gap-2"
            >
              <span className="text-muted-foreground truncate">
                {(() => {
                  if (entry.label === "امتیاز پایه اثر" || entry.kind === "base") {
                    return "امتیاز پایه اثر";
                  }
                  const fieldLabel =
                    getScoreableField(contentType, entry.field)?.label ??
                    (entry.field === "planLabels" ? "موضوع" : entry.field);
                  return entry.kind === "filled" ? `${fieldLabel} (پر بودن)` : fieldLabel;
                })()}
              </span>
              <span className="tabular-nums font-medium">
                +{formatPersianNumber(entry.points)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        این امتیاز تا تأیید محتوا ثبت رسمی نمی‌شود و در رتبه‌بندی لحاظ نمی‌گردد.
      </p>
    </div>
  );
}
