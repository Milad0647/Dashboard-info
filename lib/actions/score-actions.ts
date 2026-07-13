"use server";

import { revalidatePath } from "next/cache";
import { canScoreContent } from "@/lib/auth/access";
import { getAuthSession } from "@/lib/auth/get-session";
import { normalizeScoreValue } from "@/lib/content-score";
import { getSql } from "@/lib/db/client";
import type { ScoreableContentType } from "@/lib/types";
import { isPostgresConfigured } from "@/lib/utils";

const TABLE_BY_TYPE: Record<ScoreableContentType, string> = {
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

export async function saveContentScoreAction(input: {
  campaignId: string;
  contentType: ScoreableContentType;
  contentId: string;
  score: number | null;
}): Promise<{ success: boolean; error?: string }> {
  const session = await getAuthSession();
  if (!session || !canScoreContent(session)) {
    return { success: false, error: "فقط مدیر و کارفرما می‌توانند امتیاز بدهند" };
  }

  if (!isPostgresConfigured()) {
    return { success: false, error: "ذخیره امتیاز فقط روی دیتابیس فعال است" };
  }

  const table = TABLE_BY_TYPE[input.contentType];
  if (!table) return { success: false, error: "نوع محتوا نامعتبر است" };

  const normalized = normalizeScoreValue(input.score);
  if (!normalized.ok) {
    return { success: false, error: normalized.error };
  }
  const score = normalized.value;

  const sql = getSql();
  const now = new Date().toISOString();

  // Parameterized table name is fixed from allowlist above.
  if (table === "billboards") {
    await sql`UPDATE billboards SET score = ${score}, updated_at = ${now} WHERE id = ${input.contentId} AND campaign_id = ${input.campaignId}`;
  } else if (table === "posters") {
    await sql`UPDATE posters SET score = ${score}, updated_at = ${now} WHERE id = ${input.contentId} AND campaign_id = ${input.campaignId}`;
  } else if (table === "videos") {
    await sql`UPDATE videos SET score = ${score}, updated_at = ${now} WHERE id = ${input.contentId} AND campaign_id = ${input.campaignId}`;
  } else if (table === "campaign_files") {
    await sql`UPDATE campaign_files SET score = ${score}, updated_at = ${now} WHERE id = ${input.contentId} AND campaign_id = ${input.campaignId}`;
  } else if (table === "raw_media_uploads") {
    await sql`UPDATE raw_media_uploads SET score = ${score}, updated_at = ${now} WHERE id = ${input.contentId} AND campaign_id = ${input.campaignId}`;
  } else if (table === "social_media_posts") {
    await sql`UPDATE social_media_posts SET score = ${score}, updated_at = ${now} WHERE id = ${input.contentId} AND campaign_id = ${input.campaignId}`;
  } else if (table === "campaign_activities") {
    await sql`UPDATE campaign_activities SET score = ${score}, updated_at = ${now} WHERE id = ${input.contentId} AND campaign_id = ${input.campaignId}`;
  } else if (table === "broadcast_reports") {
    await sql`UPDATE broadcast_reports SET score = ${score}, updated_at = ${now} WHERE id = ${input.contentId} AND campaign_id = ${input.campaignId}`;
  } else if (table === "campaign_meetings") {
    await sql`UPDATE campaign_meetings SET score = ${score}, updated_at = ${now} WHERE id = ${input.contentId} AND campaign_id = ${input.campaignId}`;
  }

  revalidatePath(`/admin`);
  revalidatePath(`/campaign`);
  return { success: true };
}
