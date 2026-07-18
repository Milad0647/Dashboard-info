"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BillboardModal } from "@/components/public/billboard-modal";
import { BillboardThumbnail } from "@/components/public/billboard-thumbnail";
import { resolveBillboardCategoryDisplay } from "@/lib/billboard-categories";
import { formatBillboardCityLine } from "@/lib/billboard-location";
import { getBillboardCardImage, hasBillboardDisplayImage } from "@/lib/billboards";
import type { Billboard } from "@/lib/types";
import { formatPersianNumber } from "@/lib/utils";

interface LeaderboardBillboardsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  billboards: Billboard[];
}

export function LeaderboardBillboardsModal({
  open,
  onOpenChange,
  title,
  billboards,
}: LeaderboardBillboardsModalProps) {
  const [selected, setSelected] = useState<Billboard | null>(null);

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) setSelected(null);
          onOpenChange(next);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="break-words">
              تبلیغات محیطی — {title}
            </DialogTitle>
          </DialogHeader>

          {billboards.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              تبلیغات محیطی‌ای برای این مورد یافت نشد.
            </p>
          ) : (
            <ul className="space-y-3">
              {billboards.map((billboard) => {
                const canShowImage = hasBillboardDisplayImage(billboard);
                const categoryLabel = resolveBillboardCategoryDisplay(billboard);
                return (
                  <li key={billboard.id}>
                    <button
                      type="button"
                      className="apple-press flex w-full max-w-full items-center gap-3 rounded-lg border p-3 text-right hover:border-primary/50 hover:bg-muted/40 hover:shadow-sm"
                      onClick={() => setSelected(billboard)}
                    >
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-muted">
                        {canShowImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={getBillboardCardImage(billboard)}
                            alt={billboard.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <BillboardThumbnail
                            billboard={billboard}
                            alt={billboard.title}
                            sizes="56px"
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="break-words text-sm font-medium">{billboard.title}</p>
                        {categoryLabel && (
                          <Badge variant="secondary" className="text-[10px] font-normal">
                            {categoryLabel}
                          </Badge>
                        )}
                        <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {formatBillboardCityLine(billboard)}
                        </p>
                      </div>
                      {typeof billboard.areaSqm === "number" && billboard.areaSqm > 0 && (
                        <Badge variant="outline" className="shrink-0 text-[10px]">
                          {formatPersianNumber(billboard.areaSqm)} م²
                        </Badge>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <BillboardModal
        open={Boolean(selected)}
        onOpenChange={(next) => {
          if (!next) setSelected(null);
        }}
        billboard={selected}
      />
    </>
  );
}
