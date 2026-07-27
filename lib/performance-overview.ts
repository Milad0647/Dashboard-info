import type { LeaderboardSourceData } from "@/lib/city-leaderboard";
import { splitPressActivities } from "@/lib/press-publications";
import { splitSocialPosts } from "@/lib/social-posts";
import type {
  Billboard,
  CampaignActivity,
  CampaignFile,
  Poster,
  SocialMediaPost,
  Video,
} from "@/lib/types";

export type AdminPerformanceSourceInput = {
  billboards?: Billboard[] | null;
  posters?: Poster[] | null;
  videos?: Video[] | null;
  socialPosts?: SocialMediaPost[] | null;
  activities?: CampaignActivity[] | null;
  files?: CampaignFile[] | null;
};

/** Build leaderboard input from admin campaign data (includes drafts). */
export function buildLeaderboardSourceFromAdmin(
  data: AdminPerformanceSourceInput
): LeaderboardSourceData {
  const { sitePublications, socialPosts } = splitSocialPosts(data.socialPosts ?? []);
  const { pressPublications, fieldActivities } = splitPressActivities(data.activities ?? []);

  return {
    sections: {
      billboards: true,
      posters: true,
      videos: true,
      socialPosts: true,
      sitePublications: true,
      activities: true,
      files: true,
    },
    billboards: data.billboards ?? [],
    posters: data.posters ?? [],
    videos: data.videos ?? [],
    socialPosts,
    sitePublications,
    activities: fieldActivities,
    pressPublications,
    files: data.files ?? [],
  };
}
