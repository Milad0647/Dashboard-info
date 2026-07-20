"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EditSuggestionList } from "@/components/admin/edit-suggestion-list";
import type { EditSuggestionItem } from "@/lib/edit-suggestions";

interface CompletenessIssuesTriggerProps {
  label: string;
  href: string;
  suggestions: EditSuggestionItem[];
  children: ReactNode;
}

export function CompletenessIssuesTrigger({
  label,
  href,
  suggestions,
  children,
}: CompletenessIssuesTriggerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" className="h-full w-full text-right" onClick={() => setOpen(true)}>
        {children}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-hidden p-0">
          <DialogHeader className="border-b px-6 py-4 pr-12">
            <DialogTitle>موارد پیشنهادی — {label}</DialogTitle>
            <DialogDescription>
              همه موارد ناقص این بخش یکجا نمایش داده شده‌اند. با زدن ویرایش، کارت مربوط باز می‌شود و
              فیلدهای جاافتاده قرمز مشخص می‌شوند.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
            <EditSuggestionList suggestions={suggestions} hideContentTypeBadge />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-6 py-4">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              بستن
            </Button>
            <Button asChild variant="outline">
              <Link href={href}>
                رفتن به بخش
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
