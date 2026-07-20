"use client";

import { useCallback, useEffect, useState } from "react";
import { useCampaignExportMode } from "@/lib/context/campaign-export-context";
import { PUBLIC_MEDIA_PAGE_SIZE } from "@/lib/public-media-section";

export function useSectionPagination(
  totalCount: number,
  _itemsPerRow?: number,
  _maxRows?: number,
  resetKey = ""
) {
  const exportMode = useCampaignExportMode();
  const pageSize = PUBLIC_MEDIA_PAGE_SIZE;
  const [visibleCount, setVisibleCount] = useState(pageSize);

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [pageSize, resetKey]);

  const loadMore = useCallback(() => {
    setVisibleCount((count) => count + pageSize);
  }, [pageSize]);

  const revealContentId = useCallback((contentId: string, orderedIds: string[]) => {
    const index = orderedIds.indexOf(contentId);
    if (index === -1) return;
    setVisibleCount((count) => Math.max(count, index + 1));
  }, []);

  const effectiveCount = exportMode ? totalCount : Math.min(visibleCount, totalCount);
  const hasMore = !exportMode && effectiveCount < totalCount;

  return { effectiveCount, hasMore, loadMore, pageSize, revealContentId };
}
