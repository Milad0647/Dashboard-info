export interface ContributorPermissions {
  billboards: boolean;
  posters: boolean;
  videos: boolean;
  files: boolean;
  analytics: boolean;
  socialPosts: boolean;
  broadcast: boolean;
  submissions: boolean;
}

export type ContributorPermissionKey = keyof ContributorPermissions;

export const defaultContributorPermissions = (): ContributorPermissions => ({
  billboards: true,
  posters: true,
  videos: true,
  files: true,
  analytics: true,
  socialPosts: true,
  broadcast: true,
  submissions: true,
});

export const contributorPermissionLabels: Record<ContributorPermissionKey, string> = {
  billboards: "بیلبوردها",
  posters: "پوسترها",
  videos: "ویدیوها",
  files: "فایل‌ها",
  analytics: "آمار سایت",
  socialPosts: "شبکه‌های اجتماعی",
  broadcast: "پخش صدا و سیما",
  submissions: "مشارکت‌ها",
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
    analytics: record.analytics ?? defaults.analytics,
    socialPosts: record.socialPosts ?? defaults.socialPosts,
    broadcast: record.broadcast ?? defaults.broadcast,
    submissions: record.submissions ?? defaults.submissions,
  };
}

export function hasContributorPermission(
  permissions: ContributorPermissions | null | undefined,
  key: ContributorPermissionKey
): boolean {
  if (!permissions) return true;
  return permissions[key];
}
