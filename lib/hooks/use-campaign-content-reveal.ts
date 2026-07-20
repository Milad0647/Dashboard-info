"use client";

import { useEffect } from "react";
import {
  CAMPAIGN_REVEAL_CONTENT_EVENT,
  type CampaignRevealContentDetail,
  scrollCampaignContentIntoView,
} from "@/lib/campaign-content-scroll";

export function useCampaignContentReveal(
  sectionId: string,
  itemIds: string[],
  revealContentId: (contentId: string) => void
) {
  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<CampaignRevealContentDetail>).detail;
      if (detail.sectionId !== sectionId) return;
      if (!itemIds.includes(detail.contentId)) return;

      revealContentId(detail.contentId);

      window.setTimeout(() => scrollCampaignContentIntoView(detail.contentId), 80);
      window.setTimeout(() => scrollCampaignContentIntoView(detail.contentId), 240);
    };

    window.addEventListener(CAMPAIGN_REVEAL_CONTENT_EVENT, handler);
    return () => window.removeEventListener(CAMPAIGN_REVEAL_CONTENT_EVENT, handler);
  }, [sectionId, itemIds, revealContentId]);
}
