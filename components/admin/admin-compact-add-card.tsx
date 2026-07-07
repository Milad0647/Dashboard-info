"use client";

import { cn } from "@/lib/utils";

interface AdminCompactAddCardProps {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  aspectClass?: string;
}

export function AdminCompactAddCard({
  onClick,
  disabled,
  label = "ثبت جدید",
  aspectClass = "aspect-[4/3]",
}: AdminCompactAddCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group w-full overflow-hidden rounded-xl border-2 border-dashed bg-muted/30 text-muted-foreground transition-all",
        "hover:border-primary hover:bg-primary/5 hover:text-primary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "disabled:pointer-events-none disabled:opacity-50"
      )}
    >
      <div className={cn("flex flex-col items-center justify-center gap-2 p-4", aspectClass)}>
        <span className="text-3xl leading-none">+</span>
        <span className="text-xs font-medium">{label}</span>
      </div>
    </button>
  );
}
