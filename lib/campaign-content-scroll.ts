export const CAMPAIGN_REVEAL_CONTENT_EVENT = "campaign:reveal-content";

export interface CampaignRevealContentDetail {
  sectionId: string;
  contentId: string;
}

export function campaignContentElementId(contentId: string): string {
  return `campaign-content-${contentId}`;
}

export function dispatchCampaignRevealContent(sectionId: string, contentId: string): void {
  window.dispatchEvent(
    new CustomEvent<CampaignRevealContentDetail>(CAMPAIGN_REVEAL_CONTENT_EVENT, {
      detail: { sectionId, contentId },
    })
  );
}

export function highlightCampaignContent(contentId: string): void {
  const element = document.getElementById(campaignContentElementId(contentId));
  if (!element) return;
  element.classList.add("campaign-content-highlight");
  window.setTimeout(() => element.classList.remove("campaign-content-highlight"), 2200);
}

export function scrollCampaignContentIntoView(contentId: string): boolean {
  const element = document.getElementById(campaignContentElementId(contentId));
  if (!element) return false;
  element.scrollIntoView({ behavior: "smooth", block: "center" });
  highlightCampaignContent(contentId);
  return true;
}
