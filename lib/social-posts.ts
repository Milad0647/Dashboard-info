import type { SocialMediaPost, SocialPlatform, SocialPostLinkEntry } from "@/lib/types";
import { ensureHttpUrl } from "@/lib/utils";

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
    mediaUrl: null,
    coverImageUrl: null,
  };
}

function parseOptionalTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
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

  const result: SocialPostLinkEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const link = ensureHttpUrl(typeof record.link === "string" ? record.link : "");
    if (!link) continue;

    const viewsRaw = record.views;
    const views =
      typeof viewsRaw === "number"
        ? viewsRaw
        : typeof viewsRaw === "string"
          ? Number(viewsRaw)
          : 0;

    const id = typeof record.id === "string" && record.id ? record.id : crypto.randomUUID();
    const platform = isSocialPlatform(record.platform) ? record.platform : undefined;
    const mediaUrl = parseOptionalTrimmedString(record.mediaUrl);
    const coverImageUrl = parseOptionalTrimmedString(record.coverImageUrl);

    result.push({
      id,
      link,
      views: Number.isFinite(views) && views >= 0 ? Math.floor(views) : 0,
      ...(platform ? { platform } : {}),
      ...(mediaUrl ? { mediaUrl } : {}),
      ...(coverImageUrl ? { coverImageUrl } : {}),
    });

    if (result.length >= MAX_SOCIAL_POST_LINK_ENTRIES) break;
  }

  return result;
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

  const result: SocialPostLinkEntry[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;

    const linkRaw = typeof record.link === "string" ? record.link.trim() : "";
    const link = linkRaw ? ensureHttpUrl(linkRaw) : "";

    const viewsRaw = record.views;
    const views =
      typeof viewsRaw === "number"
        ? viewsRaw
        : typeof viewsRaw === "string"
          ? Number(viewsRaw)
          : 0;

    const id = typeof record.id === "string" && record.id ? record.id : crypto.randomUUID();
    const platform = isSocialPlatform(record.platform) ? record.platform : undefined;
    const mediaUrl = parseOptionalTrimmedString(record.mediaUrl);
    const coverImageUrl = parseOptionalTrimmedString(record.coverImageUrl);

    result.push({
      id,
      link,
      views: Number.isFinite(views) && views >= 0 ? Math.floor(views) : 0,
      ...(platform ? { platform } : {}),
      ...(mediaUrl ? { mediaUrl } : {}),
      ...(coverImageUrl ? { coverImageUrl } : {}),
    } satisfies SocialPostLinkEntry);

    if (result.length >= MAX_SOCIAL_POST_LINK_ENTRIES) break;
  }

  return result;
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

/**
 * Pick which media a card should render for a social post.
 * - Prefer media from the primary (post.platform) link entry when available.
 * - Otherwise prefer the first entry that has media.
 * - Fallback to post-level media.
 */
export function resolveSocialPostCardMedia(post: SocialMediaPost): {
  mediaUrl: string | null;
  coverImageUrl: string | null;
} {
  const entries = post.linkEntries ?? [];
  if (entries.length === 0) {
    return { mediaUrl: post.mediaUrl ?? null, coverImageUrl: post.coverImageUrl ?? null };
  }

  if (post.platform !== "site") {
    const matched = entries.find((entry) => entry.platform === post.platform);
    if (matched && (matched.mediaUrl?.trim() || matched.coverImageUrl?.trim())) {
      return {
        mediaUrl: matched.mediaUrl ?? post.mediaUrl ?? null,
        coverImageUrl: matched.coverImageUrl ?? post.coverImageUrl ?? null,
      };
    }
  }

  const firstWithMedia = entries.find((entry) => Boolean(entry.mediaUrl?.trim() || entry.coverImageUrl?.trim()));
  const selected = firstWithMedia ?? entries[0];

  return {
    mediaUrl: selected.mediaUrl ?? post.mediaUrl ?? null,
    coverImageUrl: selected.coverImageUrl ?? post.coverImageUrl ?? null,
  };
}
