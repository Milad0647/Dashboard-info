import Link from "next/link";
import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  editSuggestionContentTypeLabels,
  editSuggestionFieldLabels,
  hasOnlyRecommendedMissingFields,
  type EditSuggestionItem,
} from "@/lib/edit-suggestions";
import { cn } from "@/lib/utils";

interface EditSuggestionListProps {
  suggestions: EditSuggestionItem[];
  /** Hide content-type badge when all items share one category. */
  hideContentTypeBadge?: boolean;
}

export function EditSuggestionList({
  suggestions,
  hideContentTypeBadge = false,
}: EditSuggestionListProps) {
  return (
    <div className="space-y-3">
      {suggestions.map((suggestion) => {
        const isSoftOnly = hasOnlyRecommendedMissingFields(suggestion.missingFields);
        return (
          <div
            key={`${suggestion.contentType}:${suggestion.id}`}
            className={cn(
              "rounded-xl border p-4",
              isSoftOnly
                ? "border-warning/30 bg-warning/10"
                : "border-destructive/20 bg-destructive/5"
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  {!hideContentTypeBadge ? (
                    <Badge variant="outline">
                      {editSuggestionContentTypeLabels[suggestion.contentType]}
                    </Badge>
                  ) : null}
                  <p className="truncate font-medium">{suggestion.title}</p>
                  {suggestion.ownerName ? (
                    <span className="text-xs text-muted-foreground">{suggestion.ownerName}</span>
                  ) : null}
                </div>
                <p
                  className={cn(
                    "text-sm",
                    isSoftOnly ? "text-amber-800 dark:text-amber-200" : "text-destructive"
                  )}
                >
                  {isSoftOnly ? "بهتر است تکمیل شود: " : "ناقص است: "}
                  {suggestion.missingFields
                    .map((field) => editSuggestionFieldLabels[field])
                    .join("، ")}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {suggestion.missingFields.map((field) => (
                    <Badge
                      key={field}
                      variant={isSoftOnly ? "warning" : "destructive"}
                    >
                      {editSuggestionFieldLabels[field]}
                    </Badge>
                  ))}
                </div>
              </div>

              <Button asChild size="sm" className="shrink-0">
                <Link href={suggestion.editHref}>
                  <Pencil className="h-3.5 w-3.5" />
                  ویرایش
                </Link>
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
