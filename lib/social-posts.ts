import type { SocialMediaPost, SocialPostLinkEntry } from "@/lib/types";

export const MAX_SOCIAL_POST_LINK_ENTRIES = 200;

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

export function createEmptySocialPostLinkEntry(): SocialPostLinkEntry {
  return { id: crypto.randomUUID(), link: "", views: 0 };
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
      return {
        id,
        link,
        views: Number.isFinite(views) && views >= 0 ? Math.floor(views) : 0,
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

export function sumSocialPostLinkEntryViews(entries: SocialPostLinkEntry[]): number {
  return entries.reduce((sum, entry) => sum + (entry.views ?? 0), 0);
}
