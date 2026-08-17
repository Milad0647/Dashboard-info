"use client";

import { Badge } from "@/components/ui/badge";
import {
  EMPTY_CONTENT_FIELD_LABELS,
  type EmptyContentField,
} from "@/lib/empty-content-fields";
import { cn } from "@/lib/utils";

export function EmptyFieldsBadges({
  fields,
  className,
}: {
  fields?: EmptyContentField[];
  className?: string;
}) {
  if (!fields || fields.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {fields.map((field) => (
        <Badge key={field} variant="destructive" className="text-[10px] px-1.5 py-0 font-normal">
          بدون {EMPTY_CONTENT_FIELD_LABELS[field]}
        </Badge>
      ))}
    </div>
  );
}
