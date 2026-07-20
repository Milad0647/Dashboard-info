"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveContentScoreAction } from "@/lib/actions/score-actions";
import { parseScoreInput } from "@/lib/content-score";
import { sumFinalScore } from "@/lib/scoring/compute-content-score";
import type { ScoreableContentType } from "@/lib/types";
import { formatPersianNumber } from "@/lib/utils";

interface ContentScoreControlProps {
  campaignId: string;
  contentType: ScoreableContentType;
  contentId: string;
  /** Final score (auto + manual). */
  score: number | null | undefined;
  autoScore?: number | null;
  manualScore?: number | null;
  canScore: boolean;
  onScoreSaved?: (score: number | null) => void;
  compact?: boolean;
}

function scoreToInputValue(score: number | null | undefined): string {
  return typeof score === "number" && Number.isFinite(score) ? String(score) : "";
}

function resolveAuto(autoScore: number | null | undefined, score: number | null | undefined, manual: number): number {
  if (typeof autoScore === "number" && Number.isFinite(autoScore)) return autoScore;
  if (typeof score === "number" && Number.isFinite(score)) {
    return Math.max(0, score - manual);
  }
  return 0;
}

export function ContentScoreControl({
  campaignId,
  contentType,
  contentId,
  score,
  autoScore,
  manualScore,
  canScore,
  onScoreSaved,
  compact = false,
}: ContentScoreControlProps) {
  const initialManual =
    typeof manualScore === "number" && Number.isFinite(manualScore)
      ? manualScore
      : 0;
  const [value, setValue] = useState(() => scoreToInputValue(initialManual));
  const [displayAuto, setDisplayAuto] = useState(() =>
    resolveAuto(autoScore, score, initialManual)
  );
  const [displayTotal, setDisplayTotal] = useState(() =>
    typeof score === "number" && Number.isFinite(score)
      ? score
      : sumFinalScore(autoScore, initialManual)
  );
  const [isPending, startTransition] = useTransition();
  const lastSavedRef = useRef(scoreToInputValue(initialManual));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const manual =
      typeof manualScore === "number" && Number.isFinite(manualScore) ? manualScore : 0;
    const next = scoreToInputValue(manual);
    setValue(next);
    lastSavedRef.current = next;
    setDisplayAuto(resolveAuto(autoScore, score, manual));
    setDisplayTotal(
      typeof score === "number" && Number.isFinite(score)
        ? score
        : sumFinalScore(autoScore, manual)
    );
  }, [score, autoScore, manualScore, contentId]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Contributors: show final score only when set (including 0).
  if (!canScore) {
    if (typeof score !== "number" || !Number.isFinite(score)) return null;
    return (
      <div className="inline-flex items-center gap-1 rounded-md bg-warning/10 px-2 py-1 text-xs text-warning">
        <Star className="h-3 w-3 fill-current" />
        امتیاز: {formatPersianNumber(score)}
      </div>
    );
  }

  const persist = (raw: string) => {
    if (raw === lastSavedRef.current) return;

    const parsed = parseScoreInput(raw);
    if (!parsed.ok) {
      toast.error(parsed.error);
      return;
    }

    startTransition(async () => {
      const result = await saveContentScoreAction({
        campaignId,
        contentType,
        contentId,
        score: parsed.value,
      });
      if (!result.success) {
        toast.error(result.error ?? "ذخیره امتیاز ناموفق بود");
        return;
      }
      lastSavedRef.current = raw;
      if (typeof result.autoScore === "number") setDisplayAuto(result.autoScore);
      if (typeof result.manualScore === "number") {
        setValue(scoreToInputValue(result.manualScore));
      }
      if (typeof result.score === "number") {
        setDisplayTotal(result.score);
        onScoreSaved?.(result.score);
      } else {
        onScoreSaved?.(parsed.value);
      }
    });
  };

  const scheduleSave = (raw: string) => {
    setValue(raw);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => persist(raw), 500);
  };

  const input = (
    <Input
      type="number"
      min={0}
      step={1}
      value={value}
      onChange={(e) => scheduleSave(e.target.value)}
      onBlur={() => persist(value)}
      dir="ltr"
      placeholder="۰"
      className={compact ? "h-7 w-14 px-1 text-xs" : "max-w-[120px]"}
      disabled={isPending}
      aria-label="امتیاز دستی اضافه"
      title="امتیاز دستی اضافه"
    />
  );

  if (compact) {
    return (
      <div
        className="flex min-w-0 flex-col gap-0.5 text-[10px]"
        onClick={(e) => e.stopPropagation()}
        title={`خودکار: ${displayAuto} + دستی: ${value || 0} = ${displayTotal}`}
      >
        <div className="flex min-w-0 items-center gap-1">
          <Star className="h-3.5 w-3.5 shrink-0 text-warning" />
          <span className="text-muted-foreground">جمع:</span>
          <span className="font-medium text-warning">{formatPersianNumber(displayTotal)}</span>
          <span className="truncate text-muted-foreground">
            (خودکار {formatPersianNumber(displayAuto)})
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">دستی:</span>
          {input}
          {isPending && <span className="text-muted-foreground">...</span>}
        </div>
      </div>
    );
  }

  return (
    <div
      className="space-y-2 rounded-lg border border-warning/30 bg-warning/5 p-3"
      onClick={(e) => e.stopPropagation()}
    >
      <Label className="flex items-center gap-1.5 text-sm">
        <Star className="h-3.5 w-3.5 text-warning" />
        امتیازدهی
      </Label>
      <div className="grid gap-2 text-sm sm:grid-cols-3">
        <div className="rounded-md bg-background/60 px-2 py-1.5">
          <p className="text-[11px] text-muted-foreground">جمع نهایی</p>
          <p className="font-semibold text-warning">{formatPersianNumber(displayTotal)}</p>
        </div>
        <div className="rounded-md bg-background/60 px-2 py-1.5">
          <p className="text-[11px] text-muted-foreground">خودکار</p>
          <p className="font-medium">{formatPersianNumber(displayAuto)}</p>
        </div>
        <div>
          <p className="mb-1 text-[11px] text-muted-foreground">دستی اضافه</p>
          <div className="flex items-center gap-2">
            {input}
            {isPending && (
              <span className="text-xs text-muted-foreground">در حال ذخیره...</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
