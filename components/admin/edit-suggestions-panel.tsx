"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EditSuggestionList } from "@/components/admin/edit-suggestion-list";
import type { EditSuggestionItem } from "@/lib/edit-suggestions";
import { formatPersianNumber } from "@/lib/utils";

interface EditSuggestionsPanelProps {
  suggestions: EditSuggestionItem[];
  storageKey: string;
}

export function EditSuggestionsPanel({ suggestions, storageKey }: EditSuggestionsPanelProps) {
  const [open, setOpen] = useState(false);
  const hasSuggestions = suggestions.length > 0;

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
                  {formatPersianNumber(suggestions.length)} کارت در بخش‌های مختلف هنوز کامل نشده
                  است. فیلدهای جاافتاده را تکمیل کنید.
                </p>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
              مشاهده همه پیشنهادها
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
              همه کارت‌های ناقص شما به‌همراه فیلدهای جاافتاده. با زدن ویرایش همان کارت باز می‌شود و
              فیلدهای ناقص قرمز مشخص می‌شوند.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
            <EditSuggestionList suggestions={suggestions} />
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
