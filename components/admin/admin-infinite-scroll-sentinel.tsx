"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useInView } from "@/lib/hooks/use-in-view";
import { formatPersianNumber } from "@/lib/utils";

interface AdminInfiniteScrollSentinelProps {
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  remaining?: number;
}

export function AdminInfiniteScrollSentinel({
  hasMore,
  isLoadingMore,
  onLoadMore,
  remaining,
}: AdminInfiniteScrollSentinelProps) {
  const { ref, inView } = useInView<HTMLDivElement>({
    rootMargin: "320px",
    triggerOnce: false,
  });

  useEffect(() => {
    if (!inView || !hasMore || isLoadingMore) return;
    onLoadMore();
  }, [inView, hasMore, isLoadingMore, onLoadMore]);

  if (!hasMore && !isLoadingMore) return null;

  return (
    <div
      ref={ref}
      className="flex min-h-12 items-center justify-center gap-2 py-4 text-sm text-muted-foreground"
      aria-hidden={!hasMore}
    >
      {isLoadingMore ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          در حال بارگذاری موارد بعدی…
        </>
      ) : hasMore ? (
        <span>
          اسکرول کنید تا{" "}
          {typeof remaining === "number" ? formatPersianNumber(remaining) : "موارد"} بیشتر نمایش داده شود
        </span>
      ) : null}
    </div>
  );
}
