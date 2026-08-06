"use client";

import { Badge } from "@/components/ui/badge";
import { AdminCreatedAtText } from "@/components/admin/admin-created-at";
import { AdminItemActions } from "@/components/admin/admin-item-actions";
import { AdminOwnerBadge } from "@/components/admin/admin-owner-badge";
import { AdminPlanLabelsBadges } from "@/components/admin/admin-plan-labels-badges";
import { ContentScoreControl } from "@/components/admin/content-score-control";
import { SocialPlatformIcon, getSocialPlatformLabel } from "@/components/public/social-platform-icon";
import { InlineVideoPlayer } from "@/components/media/inline-video-player";
import { MediaThumbnail } from "@/components/ui/media-thumbnail";
import { Music } from "lucide-react";
import { getSocialPostLinkEntryPlatforms, resolveSocialPostCardMedia } from "@/lib/social-posts";
import type { SocialMediaPost, SocialPlatform } from "@/lib/types";
import { cn, formatPersianDate, formatPersianNumber, getStatusLabel } from "@/lib/utils";
import { isDirectAudioUrl, isDirectVideoUrl } from "@/lib/media-utils";

interface AdminSocialPostCompactCardProps {
  post: SocialMediaPost;
  onClick: () => void;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  canScore?: boolean;
  onScoreSaved?: (score: number | null) => void;
}

export function AdminSocialPostCompactCard({
  post,
  onClick,
  onView,
  onEdit,
  onDelete,
  canScore = false,
  onScoreSaved,
}: AdminSocialPostCompactCardProps) {
  const { mediaUrl, coverImageUrl } = resolveSocialPostCardMedia(post);
  const entryPlatforms = getSocialPostLinkEntryPlatforms(post.linkEntries);
  const platformBadges =
    entryPlatforms.length > 0
      ? entryPlatforms
      : post.platform !== "site"
        ? [post.platform as SocialPlatform]
        : [];

  const isAudio =
    Boolean(mediaUrl) && (post.contentType === "audio" || isDirectAudioUrl(mediaUrl as string));
  const isVideo =
    Boolean(mediaUrl) &&
    (post.contentType === "video" || post.contentType === "reel" || isDirectVideoUrl(mediaUrl as string));

  return (
    <div className="apple-lift group relative w-full overflow-hidden rounded-xl border bg-card text-right hover:border-primary/50">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {isAudio ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 bg-muted px-3 py-4">
            <Music className="h-8 w-8 text-muted-foreground" />
          </div>
        ) : isVideo && mediaUrl ? (
          <InlineVideoPlayer
            videoUrl={mediaUrl}
            thumbnailUrl={coverImageUrl}
            alt={post.title}
            sizes="200px"
            objectFit="cover"
          />
        ) : mediaUrl ? (
          <MediaThumbnail
            src={mediaUrl}
            alt={post.title}
            sizes="200px"
            objectFit="cover"
            className="apple-media-zoom"
          />
        ) : coverImageUrl ? (
          <MediaThumbnail
            src={coverImageUrl}
            alt={post.title}
            sizes="200px"
            objectFit="cover"
            className="apple-media-zoom"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-2 text-center text-xs text-muted-foreground">
            {post.title}
          </div>
        )}
        <div className="pointer-events-none absolute top-1.5 right-1.5 z-20 flex flex-wrap gap-1 justify-end">
          {platformBadges.map((platform) => (
            <Badge key={platform} variant="overlay" className="gap-1 text-[10px] px-1.5 py-0">
              <SocialPlatformIcon
                platform={platform}
                size="sm"
                className="h-3.5 w-3.5 rounded"
              />
              {getSocialPlatformLabel(platform)}
            </Badge>
          ))}
          {post.platform === "site" ? (
            <Badge variant="overlay" className="gap-1 text-[10px] px-1.5 py-0">
              {getStatusLabel(post.platform)}
            </Badge>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        onClick={onClick}
        className={cn(
          "w-full space-y-1 p-2 text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        <p className="truncate text-xs font-medium">{post.title}</p>
        <AdminPlanLabelsBadges planLabels={post.planLabels} planLabel={post.planLabel} />
        <p className="truncate text-[10px] text-muted-foreground">
          {formatPersianDate(post.publishedDate)} · {formatPersianNumber(post.views)} بازدید
          {post.linkEntries && post.linkEntries.length > 0
            ? ` · پخش گروهی (${formatPersianNumber(post.linkEntries.length)})`
            : ""}
        </p>
        <AdminCreatedAtText createdAt={post.createdAt} />
        <AdminOwnerBadge ownerUserId={post.ownerUserId} ownerName={post.ownerName} />
      </button>

      {(canScore || onView || onEdit || onDelete) && (
        <div className="flex items-end gap-2 px-2 pb-2">
          {(onView || onEdit || onDelete) && (
            <AdminItemActions
              compact
              className="shrink-0"
              onView={onView}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          )}
          {canScore && (
            <div className="min-w-0 flex-1">
              <ContentScoreControl
                campaignId={post.campaignId}
                contentType="social_post"
                contentId={post.id}
                score={post.score}
                autoScore={post.autoScore}
                manualScore={post.manualScore}
                canScore={canScore}
                compact
                onScoreSaved={onScoreSaved}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
