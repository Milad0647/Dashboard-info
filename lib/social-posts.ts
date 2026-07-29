import type { SocialMediaPost, SocialPlatform, SocialPostLinkEntry } from "@/lib/types";

export const MAX_SOCIAL_POST_LINK_ENTRIES = 200;

export const SOCIAL_PLATFORM_OPTIONS: SocialPlatform[] = [
  "instagram",
  "x",
  "telegram",
  "linkedin",
  "youtube",
  "aparat",
  "rubika",
  "eitaa",
  "soroush",
  "bale",
  "other",
];

const SOCIAL_PLATFORM_SET = new Set<string>(SOCIAL_PLATFORM_OPTIONS);

export function isSocialPlatform(value: unknown): value is SocialPlatform {
  return typeof value === "string" && SOCIAL_PLATFORM_SET.has(value);
}

export function isSitePublication(post: Pick<SocialMediaPost, "platform">): boolean {
  return post.platform === "site";
}

export function splitSocialPosts(posts: SocialMediaPost[]) {
  const sitePublications = posts.filter(isSitePublication);
  const socialPosts = posts.filter((post) => !isSitePublication(post));
  return { sitePublications, socialPosts };
}

export function isGroupSocialPost(
  post: Pick<SocialMediaPost, "linkEntries"> | { linkEntries?: SocialPostLinkEntry[] | null }
): boolean {
  return (post.linkEntries?.length ?? 0) > 0;
}

export function createEmptySocialPostLinkEntry(
  platform?: SocialPlatform
): SocialPostLinkEntry {
  return {
    id: crypto.randomUUID(),
    link: "",
    views: 0,
    ...(platform ? { platform } : {}),
  };
}

export function parseSocialPostLinkEntries(value: unknown): SocialPostLinkEntry[] {
  const raw =
    typeof value === "string"
      ? (() => {
          try {
            return JSON.parse(value) as unknown;
          } catch {
            return [];
          }
        })()
      : value;
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const link = typeof record.link === "string" ? record.link.trim() : "";
      const viewsRaw = record.views;
      const views =
        typeof viewsRaw === "number"
          ? viewsRaw
          : typeof viewsRaw === "string"
            ? Number(viewsRaw)
            : 0;
      const id = typeof record.id === "string" && record.id ? record.id : crypto.randomUUID();
      if (!link) return null;
      const platform = isSocialPlatform(record.platform) ? record.platform : undefined;
      return {
        id,
        link,
        views: Number.isFinite(views) && views >= 0 ? Math.floor(views) : 0,
        ...(platform ? { platform } : {}),
      };
    })
    .filter((item): item is SocialPostLinkEntry => Boolean(item))
    .slice(0, MAX_SOCIAL_POST_LINK_ENTRIES);
}

export function normalizeSocialPostLinkEntries(
  entries: SocialPostLinkEntry[] | null | undefined
): SocialPostLinkEntry[] {
  return parseSocialPostLinkEntries(entries ?? []);
}

/**
 * Similar to `normalizeSocialPostLinkEntries`, but keeps entries even if `link` is empty.
 * This is useful for admin edit screens that must render input rows per selected platform.
 */
export function parseSocialPostLinkEntriesForEditor(
  value: unknown
): SocialPostLinkEntry[] {
  const raw =
    typeof value === "string"
      ? (() => {
          try {
            return JSON.parse(value) as unknown;
          } catch {
            return [];
          }
        })()
      : value;

  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;

      const link = typeof record.link === "string" ? record.link.trim() : "";
      const viewsRaw = record.views;
      const views =
        typeof viewsRaw === "number"
          ? viewsRaw
          : typeof viewsRaw === "string"
            ? Number(viewsRaw)
            : 0;

      const id = typeof record.id === "string" && record.id ? record.id : crypto.randomUUID();
      const platform = isSocialPlatform(record.platform) ? record.platform : undefined;

      return {
        id,
        link,
        views: Number.isFinite(views) && views >= 0 ? Math.floor(views) : 0,
        ...(platform ? { platform } : {}),
      } satisfies SocialPostLinkEntry;
    })
    .filter((item): item is SocialPostLinkEntry => Boolean(item))
    .slice(0, MAX_SOCIAL_POST_LINK_ENTRIES);
}

export function sumSocialPostLinkEntryViews(entries: SocialPostLinkEntry[]): number {
  return entries.reduce((sum, entry) => sum + (entry.views ?? 0), 0);
}

/** Unique platforms present on link entries, in first-seen order. */
export function getSocialPostLinkEntryPlatforms(
  entries: SocialPostLinkEntry[] | null | undefined
): SocialPlatform[] {
  const seen = new Set<SocialPlatform>();
  const result: SocialPlatform[] = [];
  for (const entry of entries ?? []) {
    if (!entry.platform || seen.has(entry.platform)) continue;
    seen.add(entry.platform);
    result.push(entry.platform);
  }
  return result;
}
