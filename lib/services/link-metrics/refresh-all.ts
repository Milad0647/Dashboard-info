import { detectLinkMetricsPlatform } from "./detect";
import { fetchSocialLinkMetrics } from "./index";
import type { LinkMetricsResult } from "./types";
import * as pgExt from "@/lib/db/repository-extended";
import { isGroupSocialPost } from "@/lib/social-posts";
import type { CampaignActivity, SocialMediaPost } from "@/lib/types";
import { isPostgresConfigured } from "@/lib/utils";

const DEFAULT_DELAY_MS = 500;
const DEFAULT_MAX_ITEMS = 300;

export interface LinkRefreshRunSummary {
  startedAt: string;
  finishedAt: string;
  socialPosts: { scanned: number; updated: number; skipped: number; failed: number };
  pressItems: { scanned: number; updated: number; skipped: number; failed: number };
  errors: Array<{ id: string; kind: "social_post" | "press"; error: string }>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isLinkAutoRefreshable(
  url: string | null | undefined,
  platform?: string | null
): boolean {
  const trimmed = url?.trim() ?? "";
  if (!trimmed) return false;
  const detected = detectLinkMetricsPlatform(trimmed, platform);
  return detected === "eitaa" || detected === "aparat" || detected === "web";
}

function pickText(existing: string | null | undefined, next: string | null | undefined): string | null | undefined {
  if (existing?.trim()) return existing;
  return next ?? existing;
}

function applySocialMetrics(
  post: SocialMediaPost,
  metrics: LinkMetricsResult
): Partial<SocialMediaPost> {
  return {
    title: (post.title?.trim() || metrics.title?.trim() || post.title) ?? "",
    description: pickText(post.description, metrics.description),
    coverImageUrl: pickText(post.coverImageUrl, metrics.coverImageUrl),
    publishedDate: post.publishedDate || metrics.publishedDate || post.publishedDate,
    views: metrics.views ?? post.views,
    likes: metrics.likes ?? post.likes,
    comments: metrics.comments ?? post.comments,
    shares: metrics.shares ?? post.shares,
  };
}

function applyPressMetrics(
  activity: CampaignActivity,
  metrics: LinkMetricsResult
): Partial<CampaignActivity> {
  const nextCover = metrics.coverImageUrl?.trim() || null;
  const hasImage =
    Boolean(activity.imageUrl?.trim()) ||
    Boolean(activity.mediaItems?.some((item) => item.type === "image" && item.url.trim()));

  let mediaItems = activity.mediaItems ?? [];
  let imageUrl = activity.imageUrl ?? null;

  if (nextCover && !hasImage) {
    imageUrl = nextCover;
    mediaItems = [
      ...mediaItems,
      { id: `${activity.id}-og-cover`, type: "image" as const, url: nextCover },
    ];
  }

  return {
    title: (activity.title?.trim() || metrics.title?.trim() || activity.title) ?? "",
    description: pickText(activity.description, metrics.description),
    activityDate: activity.activityDate || metrics.publishedDate || activity.activityDate,
    imageUrl,
    mediaItems,
  };
}

export async function runDailyLinkMetricsRefresh(options?: {
  delayMs?: number;
  maxItems?: number;
}): Promise<LinkRefreshRunSummary> {
  const startedAt = new Date().toISOString();
  const delayMs = options?.delayMs ?? DEFAULT_DELAY_MS;
  const maxItems = options?.maxItems ?? DEFAULT_MAX_ITEMS;

  const summary: LinkRefreshRunSummary = {
    startedAt,
    finishedAt: startedAt,
    socialPosts: { scanned: 0, updated: 0, skipped: 0, failed: 0 },
    pressItems: { scanned: 0, updated: 0, skipped: 0, failed: 0 },
    errors: [],
  };

  if (!isPostgresConfigured()) {
    summary.finishedAt = new Date().toISOString();
    summary.errors.push({
      id: "-",
      kind: "social_post",
      error: "Database is not configured",
    });
    return summary;
  }

  const [socialPosts, pressItems] = await Promise.all([
    pgExt.pgListRefreshableSocialPosts(maxItems),
    pgExt.pgListRefreshablePressActivities(maxItems),
  ]);

  let processed = 0;

  for (const post of socialPosts) {
    if (processed >= maxItems) break;
    summary.socialPosts.scanned += 1;

    if (isGroupSocialPost(post) || !isLinkAutoRefreshable(post.link, post.platform)) {
      summary.socialPosts.skipped += 1;
      continue;
    }

    processed += 1;
    try {
      const metrics = await fetchSocialLinkMetrics(post.link, post.platform);
      if (metrics.error || metrics.supported === false) {
        summary.socialPosts.failed += 1;
        summary.errors.push({
          id: post.id,
          kind: "social_post",
          error: metrics.error ?? "unsupported",
        });
      } else {
        const patch = applySocialMetrics(post, metrics);
        await pgExt.pgSaveSocialPost({ ...post, ...patch });
        summary.socialPosts.updated += 1;
      }
    } catch (error) {
      summary.socialPosts.failed += 1;
      summary.errors.push({
        id: post.id,
        kind: "social_post",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    if (delayMs > 0) await sleep(delayMs);
  }

  for (const activity of pressItems) {
    if (processed >= maxItems) break;
    summary.pressItems.scanned += 1;

    if (!isLinkAutoRefreshable(activity.link, activity.activityType)) {
      summary.pressItems.skipped += 1;
      continue;
    }

    processed += 1;
    try {
      const metrics = await fetchSocialLinkMetrics(activity.link ?? "", activity.activityType);
      if (metrics.error || metrics.supported === false) {
        summary.pressItems.failed += 1;
        summary.errors.push({
          id: activity.id,
          kind: "press",
          error: metrics.error ?? "unsupported",
        });
      } else {
        const patch = applyPressMetrics(activity, metrics);
        await pgExt.pgSaveCampaignActivity({ ...activity, ...patch });
        summary.pressItems.updated += 1;
      }
    } catch (error) {
      summary.pressItems.failed += 1;
      summary.errors.push({
        id: activity.id,
        kind: "press",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    if (delayMs > 0) await sleep(delayMs);
  }

  summary.finishedAt = new Date().toISOString();
  return summary;
}
