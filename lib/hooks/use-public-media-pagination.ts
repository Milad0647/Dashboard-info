"use client";

import { useCallback, useEffect, useState } from "react";
import {
  PUBLIC_MEDIA_MOBILE_INITIAL,
  PUBLIC_MEDIA_MOBILE_PAGE_SIZE,
  PUBLIC_MEDIA_MOBILE_QUERY,
  PUBLIC_MEDIA_PAGE_SIZE,
} from "@/lib/public-media-section";

function getInitialVisibleCount(isMobile: boolean): number {
  return isMobile ? PUBLIC_MEDIA_MOBILE_INITIAL : PUBLIC_MEDIA_PAGE_SIZE;
}

export function usePublicMediaPagination(totalCount: number, resetKey: string) {
  const [isMobile, setIsMobile] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PUBLIC_MEDIA_PAGE_SIZE);

  useEffect(() => {
    const mediaQuery = window.matchMedia(PUBLIC_MEDIA_MOBILE_QUERY);

    const syncViewport = () => {
      const mobile = mediaQuery.matches;
      setIsMobile(mobile);
      setVisibleCount(getInitialVisibleCount(mobile));
    };

    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);
    return () => mediaQuery.removeEventListener("change", syncViewport);
  }, []);

  useEffect(() => {
    setVisibleCount(getInitialVisibleCount(isMobile));
  }, [resetKey, isMobile]);

  const loadMore = useCallback(() => {
    setVisibleCount((count) =>
      count + (isMobile ? PUBLIC_MEDIA_MOBILE_PAGE_SIZE : PUBLIC_MEDIA_PAGE_SIZE)
    );
  }, [isMobile]);

  const hasMore = visibleCount < totalCount;

  return { visibleCount, hasMore, loadMore, isMobile };
}
