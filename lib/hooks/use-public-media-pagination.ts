"use client";

import { useCallback, useEffect, useState } from "react";
import { useCampaignExportMode } from "@/lib/context/campaign-export-context";
import {
  getPublicMediaPageSize,
  PUBLIC_MEDIA_MOBILE_QUERY,
} from "@/lib/public-media-section";

function getInitialVisibleCount(width: number): number {
  return getPublicMediaPageSize(width);
}

export function usePublicMediaPagination(totalCount: number, resetKey: string, enabled = true) {
  const exportMode = useCampaignExportMode();
  const [pageSize, setPageSize] = useState(() =>
    typeof window !== "undefined" ? getPublicMediaPageSize(window.innerWidth) : 18
  );
  const [visibleCount, setVisibleCount] = useState(pageSize);

  useEffect(() => {
    const mediaQuery = window.matchMedia(PUBLIC_MEDIA_MOBILE_QUERY);

    const syncViewport = () => {
      const nextPageSize = getPublicMediaPageSize(window.innerWidth);
      setPageSize(nextPageSize);
      setVisibleCount(nextPageSize);
    };

    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);
    window.addEventListener("resize", syncViewport);
    return () => {
      mediaQuery.removeEventListener("change", syncViewport);
      window.removeEventListener("resize", syncViewport);
    };
  }, []);

  useEffect(() => {
    setVisibleCount(getInitialVisibleCount(window.innerWidth));
  }, [resetKey]);

  const loadMore = useCallback(() => {
    setVisibleCount((count) => count + pageSize);
  }, [pageSize]);

  const hasMore = enabled && !exportMode && visibleCount < totalCount;
  const effectiveVisibleCount = !enabled || exportMode ? totalCount : visibleCount;

  return { visibleCount: effectiveVisibleCount, hasMore, loadMore };
}
