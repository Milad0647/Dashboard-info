"use client";

import { useMemo, useState } from "react";
import { Star } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ImageZoom } from "@/components/ui/image-zoom";
import type { UserContentScoreItem } from "@/lib/city-leaderboard";
import { formatPersianDateTime, formatPersianNumber } from "@/lib/utils";

interface UserContentScoreModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName: string;
  items: UserContentScoreItem[];
}

export function UserContentScoreModal({
  open,
  onOpenChange,
  userName,
  items,
}: UserContentScoreModalProps) {
  const [selected, setSelected] = useState<UserContentScoreItem | null>(null);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selected?.id && item.contentType === selected?.contentType) ?? selected,
    [items, selected]
  );

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
            <DialogTitle className="break-words">محتوای امتیازدار — {userName}</DialogTitle>
          </DialogHeader>

          {items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              محتوایی برای این کاربر یافت نشد.
            </p>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => (
                <li key={`${item.contentType}-${item.id}`}>
                  <button
                    type="button"
                    className="apple-press flex w-full max-w-full items-center gap-3 rounded-lg border p-3 text-right hover:border-primary/50 hover:bg-muted/40 hover:shadow-sm"
                    onClick={() => setSelected(item)}
                  >
                    {item.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.thumbnailUrl}
                        alt={item.title}
                        className="h-14 w-14 shrink-0 rounded-md object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-muted text-[10px] text-muted-foreground">
                        {item.typeLabel}
                      </div>
                    )}
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="break-words text-sm font-medium">{item.title}</p>
                      <Badge variant="outline" className="text-[10px]">
                        {item.typeLabel}
                      </Badge>
                      {item.createdAt ? (
                        <p className="text-[10px] text-muted-foreground">
                          ثبت: {formatPersianDateTime(item.createdAt)}
                        </p>
                      ) : null}
                    </div>
                    <div className="inline-flex shrink-0 items-center gap-1 text-sm text-warning">
                      <Star className="h-3.5 w-3.5 fill-current" />
                      {item.score != null ? formatPersianNumber(item.score) : "—"}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedItem)} onOpenChange={(next) => !next && setSelected(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="break-words">{selectedItem?.title ?? "محتوا"}</DialogTitle>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-3">
              {selectedItem.thumbnailUrl ? (
                <ImageZoom
                  src={selectedItem.thumbnailUrl}
                  alt={selectedItem.title}
                  className="w-full rounded-lg bg-muted"
                  imgClassName="max-h-[70vh] w-full object-contain"
                />
              ) : (
                <div className="flex h-40 items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
                  تصویری برای این محتوا ثبت نشده است
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{selectedItem.typeLabel}</Badge>
                <span className="inline-flex items-center gap-1 text-sm text-warning">
                  <Star className="h-3.5 w-3.5 fill-current" />
                  {selectedItem.score != null ? formatPersianNumber(selectedItem.score) : "—"}
                </span>
                {selectedItem.createdAt ? (
                  <span className="text-xs text-muted-foreground">
                    ثبت: {formatPersianDateTime(selectedItem.createdAt)}
                  </span>
                ) : null}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
