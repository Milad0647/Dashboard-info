"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ScrollToTopButtonProps {
  /** Pixels scrolled before the button appears */
  threshold?: number;
  className?: string;
  /**
   * Lift the button above the fixed "گزارش مشکل" control
   * so the two never overlap on admin pages.
   */
  clearProblemReport?: boolean;
}

export function ScrollToTopButton({
  threshold = 400,
  className,
  clearProblemReport = false,
}: ScrollToTopButtonProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setIsVisible(window.scrollY > threshold);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  if (!isVisible) return null;

  return (
    <Button
      type="button"
      size="icon"
      variant="secondary"
      className={cn(
        "apple-soft-pop fixed z-[70] h-11 w-11 rounded-full border shadow-lg hover:-translate-y-1 hover:shadow-xl",
        clearProblemReport
          ? "bottom-[9.25rem] left-4 md:bottom-[10rem] md:left-6"
          : "bottom-6 left-6",
        className
      )}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="بازگشت به بالای صفحه"
      title="بازگشت به بالا"
      data-export-hide
      data-audit-label="بازگشت به بالا"
    >
      <ArrowUp className="h-5 w-5" />
    </Button>
  );
}
