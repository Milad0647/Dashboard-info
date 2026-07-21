export const TUTORIAL_SECTION_KEYS = [
  "billboards",
  "posters",
  "videos",
  "files",
  "rawMedia",
  "analytics",
  "socialAnalytics",
  "socialPosts",
  "sitePublications",
  "pressPublications",
  "activities",
  "broadcast",
  "meetings",
  "submissions",
  "smsReports",
] as const;

export type TutorialSectionKey = (typeof TUTORIAL_SECTION_KEYS)[number];

export const tutorialSectionLabels: Record<TutorialSectionKey, string> = {
  billboards: "تبلیغات محیطی",
  posters: "پوسترها",
  videos: "ویدیوها",
  files: "فایل‌ها",
  rawMedia: "راش تصویر",
  analytics: "آمار سایت",
  socialAnalytics: "شبکه‌های اجتماعی",
  socialPosts: "پست‌های شبکه اجتماعی",
  sitePublications: "انتشار در سایت",
  pressPublications: "مجله و روزنامه",
  activities: "اقدامات",
  broadcast: "پخش صدا و سیما",
  meetings: "جلسات و مصوبات",
  submissions: "مشارکت‌ها",
  smsReports: "ارسال پیام",
};

export interface TutorialStep {
  title: string;
  body: string;
  imageUrl?: string | null;
}

export interface SectionTutorial {
  sectionKey: TutorialSectionKey;
  title: string;
  version: number;
  steps: TutorialStep[];
  updatedAt: string;
}

export interface TutorialCompletionStatus {
  sectionKey: TutorialSectionKey;
  /** Tutorial content exists with at least one step. */
  hasContent: boolean;
  title: string;
  version: number;
  steps: TutorialStep[];
  /** User completed the current tutorial version. */
  isCompleted: boolean;
  completedVersion: number | null;
}

export function isTutorialSectionKey(value: unknown): value is TutorialSectionKey {
  return (
    typeof value === "string" &&
    (TUTORIAL_SECTION_KEYS as readonly string[]).includes(value)
  );
}

export function normalizeTutorialSteps(value: unknown): TutorialStep[] {
  if (!Array.isArray(value)) return [];

  return value
    .map<TutorialStep | null>((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const title = typeof record.title === "string" ? record.title.trim() : "";
      const body = typeof record.body === "string" ? record.body.trim() : "";
      const imageUrl =
        typeof record.imageUrl === "string" && record.imageUrl.trim()
          ? record.imageUrl.trim()
          : null;
      if (!title && !body && !imageUrl) return null;
      return {
        title: title || "مرحله",
        body,
        imageUrl,
      };
    })
    .filter((step): step is TutorialStep => step !== null);
}
