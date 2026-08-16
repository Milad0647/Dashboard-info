import type { ScoreableContentType } from "@/lib/types";

export const SCORE_TABLE_BY_TYPE: Record<ScoreableContentType, string> = {
  billboard: "billboards",
  poster: "posters",
  video: "videos",
  file: "campaign_files",
  raw_media: "raw_media_uploads",
  social_post: "social_media_posts",
  site_publication: "social_media_posts",
  activity: "campaign_activities",
  broadcast: "broadcast_reports",
  meeting: "campaign_meetings",
};
