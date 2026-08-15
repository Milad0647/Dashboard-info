import type { ActivityType } from "@/lib/types";
import {
  getPressPublicationCategoryLabel,
  isPressPublication,
  PRESS_ACTIVITY_TYPES,
} from "@/lib/press-publications";
import type { CampaignActivity } from "@/lib/types";

export const activityTypeOptions: ActivityType[] = [
  "magazine",
  "newspaper",
  "tract",
  "booth",
  "field",
  "poetry",
  "painting",
  "exhibition",
  "other",
];

export const fieldActivityTypeOptions = activityTypeOptions.filter(
  (type) => !PRESS_ACTIVITY_TYPES.includes(type)
);

export const pressActivityTypeOptions = activityTypeOptions.filter((type) =>
  PRESS_ACTIVITY_TYPES.includes(type)
);

export const activityTypeLabels: Record<ActivityType, string> = {
  magazine: "آگهی مجله و روزنامه",
  newspaper: "آگهی مجله و روزنامه",
  tract: "تراکت و بروشور",
  booth: "غرفه‌گذاری",
  field: "برنامه میدانی",
  poetry: "شعرخوانی",
  painting: "نقاشی و هنر",
  exhibition: "نمایشگاه",
  other: "سایر",
};

export function getActivityTypeLabel(type: string): string {
  return activityTypeLabels[type as ActivityType] ?? type;
}

/** Public/admin category badge: press content type when applicable. */
export function getActivityCategoryLabel(
  activity: Pick<CampaignActivity, "activityType" | "pressContentType">
): string {
  if (isPressPublication(activity)) {
    return getPressPublicationCategoryLabel(activity);
  }
  return getActivityTypeLabel(activity.activityType);
}
