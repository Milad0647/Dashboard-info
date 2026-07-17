"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const ADMIN_LIST_PAGE_SIZE = 12;
export const ADMIN_LIST_LOAD_DELAY_MS = 350;

export function useAdminInfiniteScroll(totalCount: number, resetKey: string) {
  const [visibleCount, setVisibleCount] = useState(ADMIN_LIST_PAGE_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setVisibleCount(ADMIN_LIST_PAGE_SIZE);
    setIsLoadingMore(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, [resetKey]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const loadMore = useCallback(() => {
    if (isLoadingMore) return;
    if (visibleCount >= totalCount) return;

    setIsLoadingMore(true);
    timerRef.current = setTimeout(() => {
      setVisibleCount((count) => Math.min(count + ADMIN_LIST_PAGE_SIZE, totalCount));
      setIsLoadingMore(false);
      timerRef.current = null;
    }, ADMIN_LIST_LOAD_DELAY_MS);
  }, [isLoadingMore, totalCount, visibleCount]);

  const hasMore = visibleCount < totalCount;
  const effectiveCount = Math.min(visibleCount, totalCount);

  return {
    visibleCount: effectiveCount,
    hasMore,
    isLoadingMore,
    loadMore,
    pageSize: ADMIN_LIST_PAGE_SIZE,
  };
}
