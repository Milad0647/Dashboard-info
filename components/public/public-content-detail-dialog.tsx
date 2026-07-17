"use client";

import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PublicContentDetailFields } from "@/components/public/public-content-detail-fields";

interface PublicContentDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  category?: string | null;
  topics?: (string | null | undefined)[];
  date?: string | null;
  ownerName?: string | null;
  description?: string | null;
  media?: ReactNode;
  extras?: ReactNode;
  actions?: ReactNode;
}

export function PublicContentDetailDialog({
  open,
  onOpenChange,
  title,
  category,
  topics,
  date,
  ownerName,
  description,
  media,
  extras,
  actions,
}: PublicContentDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto overflow-x-hidden p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="break-words text-base">{title}</DialogTitle>
        </DialogHeader>

        {media && <div className="mt-2">{media}</div>}

        <div className="space-y-4 p-4">
          <PublicContentDetailFields
            category={category}
            topics={topics}
            date={date}
            ownerName={ownerName}
            description={description}
            extras={extras}
          />
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
