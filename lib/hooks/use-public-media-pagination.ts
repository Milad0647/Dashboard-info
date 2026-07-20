"use client";

import { useCallback, useEffect, useState } from "react";
import { useCampaignExportMode } from "@/lib/context/campaign-export-context";
import { PUBLIC_MEDIA_PAGE_SIZE } from "@/lib/public-media-section";

export function usePublicMediaPagination(totalCount: number, resetKey: string, enabled = true) {
  const exportMode = useCampaignExportMode();
  const pageSize = PUBLIC_MEDIA_PAGE_SIZE;
  const [visibleCount, setVisibleCount] = useState(pageSize);

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [resetKey, pageSize]);

  const loadMore = useCallback(() => {
    setVisibleCount((count) => count + pageSize);
  }, [pageSize]);

  const revealContentId = useCallback((contentId: string, orderedIds: string[]) => {
    const index = orderedIds.indexOf(contentId);
    if (index === -1) return;
    setVisibleCount((count) => Math.max(count, index + 1));
  }, []);

  const hasMore = enabled && !exportMode && visibleCount < totalCount;
  const effectiveVisibleCount = !enabled || exportMode ? totalCount : visibleCount;

  return { visibleCount: effectiveVisibleCount, hasMore, loadMore, revealContentId };
}
