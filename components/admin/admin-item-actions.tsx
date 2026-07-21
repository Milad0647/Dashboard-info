"use client";

import { useState } from "react";
import { Eye, MessageSquare, Pencil, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AdminItemActionsProps {
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onMessage?: () => void;
  className?: string;
  compact?: boolean;
  deleteLabel?: string;
}

export function AdminItemActions({
  onView,
  onEdit,
  onDelete,
  onMessage,
  className,
  compact = false,
  deleteLabel = "این محتوا",
}: AdminItemActionsProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <div
        className={cn("flex items-center gap-1", className)}
        onClick={(event) => event.stopPropagation()}
      >
        {onView && (
          <Button
            type="button"
            variant="outline"
            size={compact ? "icon" : "sm"}
            className={cn(
              compact ? "h-7 w-7" : undefined,
              "hover:border-sky-500 hover:bg-sky-500/10 hover:text-sky-700 dark:hover:text-sky-300"
            )}
            onClick={onView}
            title="نمایش"
            aria-label="نمایش"
          >
            <Eye className="h-3.5 w-3.5" />
            {!compact && <span>نمایش</span>}
          </Button>
        )}
        {onMessage && (
          <Button
            type="button"
            variant="outline"
            size={compact ? "icon" : "sm"}
            className={cn(
              compact ? "h-7 w-7" : undefined,
              "hover:border-violet-500 hover:bg-violet-500/10 hover:text-violet-700 dark:hover:text-violet-300"
            )}
            onClick={onMessage}
            title="ارسال پیام"
            aria-label="ارسال پیام"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            {!compact && <span>پیام</span>}
          </Button>
        )}
        {onEdit && (
          <Button
            type="button"
            variant="outline"
            size={compact ? "icon" : "sm"}
            className={cn(
              compact ? "h-7 w-7" : undefined,
              "hover:border-amber-500 hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-300"
            )}
            onClick={onEdit}
            title="ویرایش"
            aria-label="ویرایش"
          >
            <Pencil className="h-3.5 w-3.5" />
            {!compact && <span>ویرایش</span>}
          </Button>
        )}
        {onDelete && (
          <Button
            type="button"
            variant="outline"
            size={compact ? "icon" : "sm"}
            className={cn(
              compact ? "h-7 w-7" : undefined,
              "hover:border-destructive hover:bg-destructive/10 hover:text-destructive"
            )}
            onClick={() => setConfirmOpen(true)}
            title="حذف"
            aria-label="حذف"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {!compact && <span>حذف</span>}
          </Button>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف {deleteLabel}؟</AlertDialogTitle>
            <AlertDialogDescription>
              آیا مطمئن هستید؟ این عمل قابل بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setConfirmOpen(false);
                onDelete?.();
              }}
            >
              بله، حذف شود
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
