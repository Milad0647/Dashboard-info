"use client";

import { MessageSquare } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { sendContentMessageAction } from "@/lib/actions/content-message-actions";
import type { ContentMessageContentType } from "@/lib/content-messages/types";
import { CONTENT_MESSAGE_TYPE_LABELS } from "@/lib/content-messages/types";
import { cn } from "@/lib/utils";

export type SendContentMessageTarget = {
  campaignId: string;
  contentType: ContentMessageContentType;
  contentId: string;
  contentTitle: string;
  ownerName?: string | null;
};

interface SendContentMessageButtonProps {
  target: SendContentMessageTarget;
  className?: string;
  compact?: boolean;
  variant?: "outline" | "default" | "ghost" | "secondary";
  size?: "sm" | "icon" | "default";
  label?: string;
}

export function SendContentMessageButton({
  target,
  className,
  compact = false,
  variant = "outline",
  size,
  label = "پیام",
}: SendContentMessageButtonProps) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();

  const resolvedSize = size ?? (compact ? "icon" : "sm");
  const typeLabel = CONTENT_MESSAGE_TYPE_LABELS[target.contentType] ?? "محتوا";

  const handleSend = () => {
    const trimmed = body.trim();
    if (trimmed.length < 3) {
      toast.error("متن پیام حداقل ۳ کاراکتر باشد");
      return;
    }

    startTransition(async () => {
      const result = await sendContentMessageAction({
        campaignId: target.campaignId,
        contentType: target.contentType,
        contentId: target.contentId,
        contentTitle: target.contentTitle,
        body: trimmed,
      });

      if (!result.success) {
        toast.error(result.error ?? "ارسال پیام ناموفق بود");
        return;
      }

      toast.success("پیام برای مالک محتوا ارسال شد");
      setBody("");
      setOpen(false);
    });
  };

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={resolvedSize}
        className={cn(
          compact ? "h-7 w-7" : "gap-1.5",
          "hover:border-violet-500 hover:bg-violet-500/10 hover:text-violet-700 dark:hover:text-violet-300",
          className
        )}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        title="ارسال پیام درباره این محتوا"
        aria-label="ارسال پیام"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        {!compact && <span>{label}</span>}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-md"
          onClick={(event) => event.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle>ارسال پیام</DialogTitle>
            <DialogDescription>
              درباره «{target.contentTitle || typeLabel}» برای{" "}
              {target.ownerName?.trim() || "مالک محتوا"} بنویسید. این پیام رد محتوا نیست؛ فقط
              توضیح یا یادآوری است.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              نوع: {typeLabel}
              {target.ownerName ? ` · گیرنده: ${target.ownerName}` : ""}
            </p>
            <Textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="مثلاً: لطفاً کیفیت تصویر را بهتر کنید یا توضیحات را کامل‌تر بنویسید…"
              rows={5}
              maxLength={2000}
              disabled={isPending}
              autoFocus
            />
            <p className="text-left text-[11px] text-muted-foreground tabular-nums">
              {body.trim().length}/۲۰۰۰
            </p>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              disabled={isPending}
              onClick={() => setOpen(false)}
            >
              انصراف
            </Button>
            <Button type="button" disabled={isPending} onClick={handleSend}>
              {isPending ? "در حال ارسال…" : "ارسال پیام"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
