"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AdminItemActions } from "@/components/admin/admin-item-actions";
import { ImageZoom } from "@/components/ui/image-zoom";

interface AdminContentPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  meta?: React.ReactNode;
  details?: Array<{ label: string; value?: React.ReactNode | null }>;
  onEdit?: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
}

export function AdminContentPreviewDialog({
  open,
  onOpenChange,
  title,
  description,
  imageUrl,
  meta,
  details = [],
  onEdit,
  onDelete,
  deleteLabel,
}: AdminContentPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!flex max-h-[92vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-6 py-4 pe-12">
          <DialogTitle className="break-words text-base">{title}</DialogTitle>
          <DialogDescription className="sr-only">پیش‌نمایش محتوا</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden px-6 py-4">
          {imageUrl ? (
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-muted">
              <ImageZoom
                src={imageUrl}
                alt={title}
                className="absolute inset-0 h-full w-full"
                imgClassName="object-contain"
                sizes="(max-width: 768px) 100vw, 42rem"
              />
            </div>
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
              تصویری ثبت نشده است
            </div>
          )}

          {description ? (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
              {description}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">بدون توضیحات</p>
          )}

          {meta}

          {details.length > 0 && (
            <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 text-sm sm:grid-cols-2">
              {details.map((detail) =>
                detail.value !== null && detail.value !== undefined && detail.value !== "" ? (
                  <div key={detail.label} className="space-y-1">
                    <p className="text-xs text-muted-foreground">{detail.label}</p>
                    <div className="break-words">{detail.value}</div>
                  </div>
                ) : null
              )}
            </div>
          )}
        </div>

        {(onEdit || onDelete) && (
          <div className="shrink-0 border-t px-6 py-3">
            <AdminItemActions
              onEdit={
                onEdit
                  ? () => {
                      onOpenChange(false);
                      onEdit();
                    }
                  : undefined
              }
              onDelete={
                onDelete
                  ? () => {
                      onOpenChange(false);
                      onDelete();
                    }
                  : undefined
              }
              deleteLabel={deleteLabel}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
