"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ScrollToTopButtonProps {
  /** Pixels scrolled before the button appears */
  threshold?: number;
  className?: string;
}

export function ScrollToTopButton({ threshold = 480, className }: ScrollToTopButtonProps) {
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
        "fixed bottom-6 left-6 z-50 h-11 w-11 rounded-full border shadow-lg",
        className
      )}
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="بازگشت به بالای صفحه"
      data-export-hide
    >
      <ArrowUp className="h-5 w-5" />
    </Button>
  );
}
