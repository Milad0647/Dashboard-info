"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Lightbulb, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  editSuggestionContentTypeLabels,
  editSuggestionFieldLabels,
  type EditSuggestionItem,
} from "@/lib/edit-suggestions";
import { formatPersianNumber } from "@/lib/utils";

interface EditSuggestionsPanelProps {
  suggestions: EditSuggestionItem[];
  storageKey: string;
}

const PREVIEW_LIMIT = 5;

export function EditSuggestionsPanel({ suggestions, storageKey }: EditSuggestionsPanelProps) {
  const [open, setOpen] = useState(false);
  const hasSuggestions = suggestions.length > 0;
  const visibleSuggestions = useMemo(() => suggestions.slice(0, PREVIEW_LIMIT), [suggestions]);
  const remainingCount = Math.max(suggestions.length - visibleSuggestions.length, 0);

  useEffect(() => {
    if (!hasSuggestions) return;
    if (typeof window === "undefined") return;

    const dismissed = window.sessionStorage.getItem(storageKey);
    if (!dismissed) setOpen(true);
  }, [hasSuggestions, storageKey]);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen && typeof window !== "undefined") {
      window.sessionStorage.setItem(storageKey, "dismissed");
    }
  };

  if (!hasSuggestions) return null;

  return (
    <>
      <Card className="border-warning/30 bg-warning/10">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
              <div className="min-w-0">
                <p className="font-medium">پیشنهاد ویرایش</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {formatPersianNumber(suggestions.length)} کارت شما هنوز کامل نشده است. بهتر است
                  فیلدهای جاافتاده را تکمیل کنید.
                </p>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
              مشاهده پیشنهادها
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-4 pr-12">
            <DialogTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-warning" />
              پیشنهاد ویرایش
            </DialogTitle>
            <DialogDescription>
              چند کارت شما هنوز اطلاعات کامل ندارد. تکمیل این فیلدها باعث می‌شود خروجی کمپین
              دقیق‌تر و حرفه‌ای‌تر نمایش داده شود.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] space-y-3 overflow-y-auto px-6 py-4">
            {visibleSuggestions.map((suggestion) => (
              <div
                key={`${suggestion.contentType}:${suggestion.id}`}
                className="rounded-xl border bg-card p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">
                        {editSuggestionContentTypeLabels[suggestion.contentType]}
                      </Badge>
                      <p className="truncate font-medium">{suggestion.title}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestion.missingFields.map((field) => (
                        <Badge key={field} variant="warning">
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
            ))}

            {remainingCount > 0 && (
              <div className="rounded-xl border border-dashed px-4 py-3 text-center text-sm text-muted-foreground">
                و {formatPersianNumber(remainingCount)} مورد دیگر در صفحات پوسترها و ویدیوها نیاز به
                تکمیل دارد.
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-6 py-4">
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)}>
              بعداً یادآوری کن
            </Button>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              متوجه شدم
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
