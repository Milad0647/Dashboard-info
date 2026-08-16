import type { LeaderboardSourceData } from "@/lib/city-leaderboard";
import { splitPressActivities } from "@/lib/press-publications";
import { splitSocialPosts } from "@/lib/social-posts";
import type {
  Billboard,
  CampaignActivity,
  CampaignFile,
  Poster,
  PosterVersion,
  PosterWithVersions,
  SocialMediaPost,
  Video,
  VideoVersion,
  VideoWithVersions,
} from "@/lib/types";

export type AdminPerformanceSourceInput = {
  billboards?: Billboard[] | null;
  posters?: Poster[] | null;
  posterVersions?: PosterVersion[] | null;
  videos?: Video[] | null;
  videoVersions?: VideoVersion[] | null;
  socialPosts?: SocialMediaPost[] | null;
  activities?: CampaignActivity[] | null;
  files?: CampaignFile[] | null;
};

function nestPosterVersions(
  posters: Poster[],
  versions: PosterVersion[]
): PosterWithVersions[] {
  const byPosterId = new Map<string, PosterVersion[]>();
  for (const version of versions) {
    const list = byPosterId.get(version.posterId) ?? [];
    list.push(version);
    byPosterId.set(version.posterId, list);
  }

  return posters.map((poster) => ({
    ...poster,
    versions: (byPosterId.get(poster.id) ?? []).sort(
      (a, b) => a.versionNumber - b.versionNumber
    ),
  }));
}

function nestVideoVersions(
  videos: Video[],
  versions: VideoVersion[]
): VideoWithVersions[] {
  const byVideoId = new Map<string, VideoVersion[]>();
  for (const version of versions) {
    const list = byVideoId.get(version.videoId) ?? [];
    list.push(version);
    byVideoId.set(version.videoId, list);
  }

  return videos.map((video) => ({
    ...video,
    versions: (byVideoId.get(video.id) ?? []).sort(
      (a, b) => a.versionNumber - b.versionNumber
    ),
  }));
}

/** Build leaderboard input from admin campaign data (includes drafts). */
export function buildLeaderboardSourceFromAdmin(
  data: AdminPerformanceSourceInput
): LeaderboardSourceData {
  const { sitePublications, socialPosts } = splitSocialPosts(data.socialPosts ?? []);
  const { pressPublications, fieldActivities } = splitPressActivities(data.activities ?? []);
  const posters = data.posters ?? [];
  const videos = data.videos ?? [];

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
    posters: nestPosterVersions(posters, data.posterVersions ?? []),
    videos: nestVideoVersions(videos, data.videoVersions ?? []),
    socialPosts,
    sitePublications,
    activities: fieldActivities,
    pressPublications,
    files: data.files ?? [],
  };
}
