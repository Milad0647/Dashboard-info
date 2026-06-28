import type { SocialAnalyticsSummary, SocialPlatform, SocialPlatformStat } from "@/lib/types";

const PLATFORM_ORDER: SocialPlatform[] = [
  "instagram",
  "telegram",
  "x",
  "youtube",
  "aparat",
  "linkedin",
  "rubika",
  "eitaa",
  "bale",
  "other",
];

export function buildSocialAnalyticsSummary(
  stats: SocialPlatformStat[]
): SocialAnalyticsSummary {
  const platforms = [...stats].sort((a, b) => {
    const orderA = PLATFORM_ORDER.indexOf(a.platform);
    const orderB = PLATFORM_ORDER.indexOf(b.platform);
    if (orderA !== orderB) return orderA - orderB;
    return a.sortOrder - b.sortOrder;
  });

  const totalFollowers = platforms.reduce((sum, item) => sum + item.followers, 0);
  const totalPosts = platforms.reduce((sum, item) => sum + item.posts, 0);

  return {
    platforms,
    totalFollowers,
    totalPosts,
    hasData: platforms.length > 0 && (totalFollowers > 0 || totalPosts > 0),
  };
}
