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
  onEdit?: () => void;
}

export function AdminContentPreviewDialog({
  open,
  onOpenChange,
  title,
  description,
  imageUrl,
  meta,
  onEdit,
}: AdminContentPreviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">پیش‌نمایش محتوا</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {imageUrl ? (
            <ImageZoom
              src={imageUrl}
              alt={title}
              className="w-full rounded-lg bg-muted"
              imgClassName="max-h-80 w-full object-contain"
            />
          ) : (
            <div className="flex h-40 items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
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

          {onEdit && (
            <AdminItemActions
              onEdit={() => {
                onOpenChange(false);
                onEdit();
              }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
