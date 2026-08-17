"use client";

import { cn, formatPersianDateTime } from "@/lib/utils";
import type { ContentMessageChatItem } from "@/lib/content-messages/thread";

function bubbleLabel(item: ContentMessageChatItem): string {
  if (item.isMine) return "شما";
  if (item.senderName?.trim()) {
    return item.isReply ? `پاسخ ${item.senderName.trim()}` : item.senderName.trim();
  }
  return item.isReply ? "پاسخ کاربر" : "مدیر / کارفرما";
}

export function ContentMessageChatThread({
  items,
  className,
}: {
  items: ContentMessageChatItem[];
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <div
      className={cn("space-y-2 rounded-xl bg-muted/20 p-3", className)}
      dir="rtl"
    >
      {items.map((item) => (
        <div
          key={item.id}
          className={cn("flex w-full", item.isMine ? "justify-end" : "justify-start")}
        >
          <div
            className={cn(
              "max-w-[88%] rounded-2xl px-3 py-2 text-sm shadow-sm sm:max-w-[75%]",
              item.isMine
                ? "rounded-es-md bg-primary text-primary-foreground"
                : "rounded-ee-md border bg-card"
            )}
          >
            <p
              className={cn(
                "mb-1 text-[10px] font-medium",
                item.isMine ? "text-primary-foreground/80" : "text-muted-foreground"
              )}
            >
              {bubbleLabel(item)}
            </p>
            <p className="whitespace-pre-wrap break-words leading-relaxed">{item.body}</p>
            <p
              className={cn(
                "mt-1 text-[10px]",
                item.isMine ? "text-primary-foreground/75" : "text-muted-foreground"
              )}
            >
              {formatPersianDateTime(item.createdAt)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
