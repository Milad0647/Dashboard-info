import { getSql } from "@/lib/db/client";

/** Lightweight existence check for create-vs-update tutorial gating. */
export async function pgIdExists(
  table:
    | "posters"
    | "videos"
    | "billboards"
    | "campaign_files"
    | "raw_media_uploads"
    | "analytics_metrics"
    | "social_media_posts"
    | "social_platform_stats"
    | "broadcast_reports"
    | "campaign_activities"
    | "campaign_meetings"
    | "sms_send_reports",
  id: string
): Promise<boolean> {
  const sql = getSql();

  switch (table) {
    case "posters": {
      const rows = await sql`SELECT 1 FROM posters WHERE id = ${id} LIMIT 1`;
      return rows.length > 0;
    }
    case "videos": {
      const rows = await sql`SELECT 1 FROM videos WHERE id = ${id} LIMIT 1`;
      return rows.length > 0;
    }
    case "billboards": {
      const rows = await sql`SELECT 1 FROM billboards WHERE id = ${id} LIMIT 1`;
      return rows.length > 0;
    }
    case "campaign_files": {
      const rows = await sql`SELECT 1 FROM campaign_files WHERE id = ${id} LIMIT 1`;
      return rows.length > 0;
    }
    case "raw_media_uploads": {
      const rows = await sql`SELECT 1 FROM raw_media_uploads WHERE id = ${id} LIMIT 1`;
      return rows.length > 0;
    }
    case "analytics_metrics": {
      const rows = await sql`SELECT 1 FROM analytics_metrics WHERE id = ${id} LIMIT 1`;
      return rows.length > 0;
    }
    case "social_media_posts": {
      const rows = await sql`SELECT 1 FROM social_media_posts WHERE id = ${id} LIMIT 1`;
      return rows.length > 0;
    }
    case "social_platform_stats": {
      const rows = await sql`SELECT 1 FROM social_platform_stats WHERE id = ${id} LIMIT 1`;
      return rows.length > 0;
    }
    case "broadcast_reports": {
      const rows = await sql`SELECT 1 FROM broadcast_reports WHERE id = ${id} LIMIT 1`;
      return rows.length > 0;
    }
    case "campaign_activities": {
      const rows = await sql`SELECT 1 FROM campaign_activities WHERE id = ${id} LIMIT 1`;
      return rows.length > 0;
    }
    case "campaign_meetings": {
      const rows = await sql`SELECT 1 FROM campaign_meetings WHERE id = ${id} LIMIT 1`;
      return rows.length > 0;
    }
    case "sms_send_reports": {
      const rows = await sql`SELECT 1 FROM sms_send_reports WHERE id = ${id} LIMIT 1`;
      return rows.length > 0;
    }
    default:
      return false;
  }
}
