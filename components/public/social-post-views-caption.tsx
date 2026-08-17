import { Eye } from "lucide-react";
import { cn, formatPersianNumber } from "@/lib/utils";

interface SocialPostViewsCaptionProps {
  views: number;
  className?: string;
}

export function SocialPostViewsCaption({ views, className }: SocialPostViewsCaptionProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 z-10",
        className
      )}
    >
      <div className="flex items-center justify-center gap-1 bg-red-600 px-2 py-1.5 text-[11px] font-bold leading-none text-white shadow-[0_-4px_12px_rgba(185,28,28,0.35)]">
        <Eye className="h-3.5 w-3.5 shrink-0" />
        <span>
          {formatPersianNumber(views)} بازدید
        </span>
      </div>
    </div>
  );
}
