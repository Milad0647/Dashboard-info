"use client";

import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  encodePlanLabel,
  formatPlanLabelDisplay,
  type ContentTopic,
} from "@/lib/content-topics";

interface PlanLabelSelectProps {
  topics?: ContentTopic[];
  /** Legacy flat plan list — used when topics is empty. */
  plans?: string[];
  value?: string | null;
  values?: string[];
  onChange?: (value: string | null) => void;
  onChangeMultiple?: (values: string[]) => void;
  label?: string;
  optional?: boolean;
  multiple?: boolean;
}

function buildOptions(topics: ContentTopic[], plans: string[]): string[] {
  if (topics.length > 0) {
    const options: string[] = [];
    for (const topic of topics) {
      options.push(topic.name);
      for (const sub of topic.subtopics) {
        options.push(encodePlanLabel(topic.name, sub));
      }
    }
    return options;
  }
  return plans;
}

export function PlanLabelSelect({
  topics = [],
  plans = [],
  value,
  values,
  onChange,
  onChangeMultiple,
  label = "موضوع",
  optional = true,
  multiple = true,
}: PlanLabelSelectProps) {
  const options = buildOptions(topics, plans);
  // Hide entirely when optional and campaign has no topics/plans configured.
  if (options.length === 0 && optional) return null;

  const selected = multiple
    ? values ?? (value?.trim() ? [value] : [])
    : value?.trim()
      ? [value]
      : [];

  const available = options.filter((option) => !selected.includes(option));

  const addValue = (next: string) => {
    if (!next || selected.includes(next)) return;
    const updated = [...selected, next];
    if (multiple && onChangeMultiple) {
      onChangeMultiple(updated);
    } else {
      onChange?.(next);
      onChangeMultiple?.(updated);
    }
  };

  const removeValue = (token: string) => {
    const updated = selected.filter((item) => item !== token);
    if (multiple && onChangeMultiple) {
      onChangeMultiple(updated);
    } else {
      onChange?.(updated[0] ?? null);
      onChangeMultiple?.(updated);
    }
  };

  const searchableOptions = available.map((option) => {
    const isSub = option.includes("|");
    return {
      value: option,
      label: isSub ? `↳ ${formatPlanLabelDisplay(option)}` : formatPlanLabelDisplay(option),
      keywords: option,
    };
  });

  return (
    <div className="space-y-2">
      <Label>
        {label}
        {!optional ? " *" : ""}
      </Label>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((token) => (
            <Badge key={token} variant="secondary" className="gap-1 pl-2">
              {formatPlanLabelDisplay(token)}
              <button
                type="button"
                className="rounded-full hover:bg-muted"
                onClick={() => removeValue(token)}
                aria-label="حذف موضوع"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      {available.length > 0 ? (
        <SearchableSelect
          key={selected.join("|")}
          value=""
          onValueChange={addValue}
          options={searchableOptions}
          placeholder={multiple ? "افزودن موضوع / زیرموضوع" : "انتخاب موضوع"}
          searchPlaceholder="جستجوی موضوع..."
          clearAfterSelect
        />
      ) : (
        selected.length === 0 && (
          <p className="text-xs text-muted-foreground">
            {optional
              ? "موضوعی تعریف نشده است."
              : "ابتدا در تنظیمات کمپین موضوع تعریف کنید."}
          </p>
        )
      )}
      {multiple && selected.length > 0 && (
        <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => {
          onChangeMultiple?.([]);
          onChange?.(null);
        }}>
          پاک کردن همه
        </Button>
      )}
    </div>
  );
}
