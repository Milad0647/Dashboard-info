"use client";

import { CircleDashed } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EMPTY_FIELD_FILTER_OPTIONS,
  type EmptyFieldFilter,
} from "@/lib/empty-content-fields";
import { cn } from "@/lib/utils";

export function EmptyFieldFilterSelect({
  value,
  onChange,
  className,
}: {
  value: EmptyFieldFilter;
  onChange: (value: EmptyFieldFilter) => void;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as EmptyFieldFilter)}>
      <SelectTrigger className={cn("w-full", className)}>
        <div className="flex items-center gap-2">
          <CircleDashed className="h-4 w-4 shrink-0 text-muted-foreground" />
          <SelectValue placeholder="فیلد خالی" />
        </div>
      </SelectTrigger>
      <SelectContent dir="rtl">
        {EMPTY_FIELD_FILTER_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
