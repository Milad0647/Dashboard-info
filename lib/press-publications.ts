import type { ActivityType, CampaignActivity, PressContentType } from "@/lib/types";

export const PRESS_ACTIVITY_TYPES: ActivityType[] = ["magazine", "newspaper"];

/** Unified label for magazine/newspaper ads in UI. */
export const PRESS_PUBLICATION_LABEL = "آگهی مجله و روزنامه";

export const PRESS_CONTENT_TYPES: PressContentType[] = [
  "news",
  "news_interview",
  "report",
  "news_report",
  "interview",
  "ad",
  "advertorial",
  "other",
];

export const pressContentTypeLabels: Record<PressContentType, string> = {
  news: "خبر",
  news_interview: "مصاحبه خبری",
  report: "گزارش",
  news_report: "گزارش خبری",
  interview: "مصاحبه",
  ad: "آگهی",
  advertorial: "رپرتاژ آگهی",
  other: "سایر",
};

const pressTypeSet = new Set<string>(PRESS_ACTIVITY_TYPES);
const pressContentTypeSet = new Set<string>(PRESS_CONTENT_TYPES);

export function isPressPublication(activity: Pick<CampaignActivity, "activityType">): boolean {
  return pressTypeSet.has(activity.activityType);
}

export function isPressContentType(value: string | null | undefined): value is PressContentType {
  return Boolean(value && pressContentTypeSet.has(value));
}

export function getPressContentTypeLabel(type: string | null | undefined): string {
  if (!isPressContentType(type)) return "";
  return pressContentTypeLabels[type];
}

/** Category badge for press cards: content type when set, else unified press label. */
export function getPressPublicationCategoryLabel(
  activity: Pick<CampaignActivity, "activityType" | "pressContentType">
): string {
  const contentLabel = getPressContentTypeLabel(activity.pressContentType);
  return contentLabel || PRESS_PUBLICATION_LABEL;
}

export function splitPressActivities(activities: CampaignActivity[]): {
  pressPublications: CampaignActivity[];
  fieldActivities: CampaignActivity[];
} {
  const pressPublications: CampaignActivity[] = [];
  const fieldActivities: CampaignActivity[] = [];

  for (const activity of activities) {
    if (isPressPublication(activity)) {
      pressPublications.push(activity);
    } else {
      fieldActivities.push(activity);
    }
  }

  return { pressPublications, fieldActivities };
}
