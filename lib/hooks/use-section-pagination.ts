"use client";

import { useCallback, useEffect, useState } from "react";
import { useCampaignExportMode } from "@/lib/context/campaign-export-context";

export function useSectionPagination(
  totalCount: number,
  itemsPerRow: number,
  maxRows = 3,
  resetKey = ""
) {
  const exportMode = useCampaignExportMode();
  const pageSize = itemsPerRow * maxRows;
  const [visibleCount, setVisibleCount] = useState(pageSize);

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [pageSize, resetKey]);

  const loadMore = useCallback(() => {
    setVisibleCount((count) => count + pageSize);
  }, [pageSize]);

  const effectiveCount = exportMode ? totalCount : Math.min(visibleCount, totalCount);
  const hasMore = !exportMode && effectiveCount < totalCount;

  return { effectiveCount, hasMore, loadMore, pageSize };
}
