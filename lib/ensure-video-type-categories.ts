import { saveMediaCategory } from "@/lib/data-access/admin";
import type { MediaCategory } from "@/lib/types";
import { VIDEO_TYPE_TITLES } from "@/lib/video-types";

/** Ensure campaign has تیزر / انیمیشن / موشن‌گرافیک video categories. */
export async function ensureVideoTypeCategories(
  campaignId: string,
  existing: MediaCategory[]
): Promise<boolean> {
  const existingTitles = new Set(existing.map((category) => category.title.trim()));
  let created = false;

  for (let index = 0; index < VIDEO_TYPE_TITLES.length; index++) {
    const title = VIDEO_TYPE_TITLES[index];
    if (existingTitles.has(title)) continue;
    await saveMediaCategory({
      campaignId,
      type: "video",
      title,
      sortOrder: index + 1,
      published: true,
    });
    created = true;
  }

  return created;
}
