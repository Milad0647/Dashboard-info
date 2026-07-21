export interface ContributorPermissions {
  billboards: boolean;
  posters: boolean;
  videos: boolean;
  files: boolean;
  rawMedia: boolean;
  analytics: boolean;
  socialPosts: boolean;
  sitePublications: boolean;
  broadcast: boolean;
  meetings: boolean;
  activities: boolean;
  submissions: boolean;
  directives: boolean;
  smsReports: boolean;
}

export type ContributorPermissionKey = keyof ContributorPermissions;

export const defaultContributorPermissions = (): ContributorPermissions => ({
  billboards: true,
  posters: true,
  videos: true,
  files: true,
  rawMedia: true,
  analytics: true,
  socialPosts: true,
  sitePublications: true,
  broadcast: true,
  meetings: true,
  activities: true,
  submissions: true,
  directives: true,
  smsReports: true,
});

export const contributorPermissionLabels: Record<ContributorPermissionKey, string> = {
  billboards: "تبلیغات محیطی",
  posters: "پوسترها",
  videos: "ویدیوها",
  files: "فایل‌ها",
  rawMedia: "راش تصویر",
  analytics: "آمار سایت",
  socialPosts: "پست‌ها و شبکه‌های اجتماعی",
  sitePublications: "انتشار در سایت",
  broadcast: "پخش صدا و سیما",
  meetings: "جلسات و مصوبات",
  activities: "اقدامات",
  submissions: "مشارکت‌ها",
  directives: "دستورکارها",
  smsReports: "ارسال پیام",
};

export function normalizeContributorPermissions(
  value: unknown
): ContributorPermissions {
  const defaults = defaultContributorPermissions();
  if (!value || typeof value !== "object") return defaults;

  const record = value as Partial<ContributorPermissions>;
  return {
    billboards: record.billboards ?? defaults.billboards,
    posters: record.posters ?? defaults.posters,
    videos: record.videos ?? defaults.videos,
    files: record.files ?? defaults.files,
    rawMedia: record.rawMedia ?? defaults.rawMedia,
    analytics: record.analytics ?? defaults.analytics,
    socialPosts: record.socialPosts ?? defaults.socialPosts,
    sitePublications: record.sitePublications ?? defaults.sitePublications,
    broadcast: record.broadcast ?? defaults.broadcast,
    meetings: record.meetings ?? defaults.meetings,
    activities: record.activities ?? defaults.activities,
    submissions: record.submissions ?? defaults.submissions,
    directives: record.directives ?? defaults.directives,
    smsReports: record.smsReports ?? defaults.smsReports,
  };
}

export function hasContributorPermission(
  permissions: ContributorPermissions | null | undefined,
  key: ContributorPermissionKey
): boolean {
  if (!permissions) return true;
  return permissions[key];
}
