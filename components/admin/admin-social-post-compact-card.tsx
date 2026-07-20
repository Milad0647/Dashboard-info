"use client";

import { Badge } from "@/components/ui/badge";
import { AdminCreatedAtText } from "@/components/admin/admin-created-at";
import { AdminItemActions } from "@/components/admin/admin-item-actions";
import { AdminOwnerBadge } from "@/components/admin/admin-owner-badge";
import { AdminPlanLabelsBadges } from "@/components/admin/admin-plan-labels-badges";
import { ContentScoreControl } from "@/components/admin/content-score-control";
import { SocialPlatformIcon, getSocialPlatformLabel } from "@/components/public/social-platform-icon";
import { MediaThumbnail } from "@/components/ui/media-thumbnail";
import type { SocialMediaPost, SocialPlatform } from "@/lib/types";
import { cn, formatPersianDate, formatPersianNumber, getStatusLabel } from "@/lib/utils";

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
  const coverUrl = post.coverImageUrl ?? post.mediaUrl ?? null;

  return (
    <div className="apple-lift group relative w-full overflow-hidden rounded-xl border bg-card text-right hover:border-primary/50">
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "w-full text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        )}
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
          {coverUrl ? (
            <MediaThumbnail src={coverUrl} alt={post.title} kind="poster" sizes="200px" objectFit="cover" />
          ) : (
            <div className="flex h-full items-center justify-center px-2 text-center text-xs text-muted-foreground">
              {post.title}
            </div>
          )}
          <div className="absolute top-1.5 right-1.5 flex flex-wrap gap-1 justify-end">
            <Badge variant="overlay" className="gap-1 text-[10px] px-1.5 py-0">
              {post.platform !== "site" ? (
                <SocialPlatformIcon
                  platform={post.platform as SocialPlatform}
                  size="sm"
                  className="h-3.5 w-3.5 rounded"
                />
              ) : null}
              {post.platform === "site"
                ? getStatusLabel(post.platform)
                : getSocialPlatformLabel(post.platform as SocialPlatform)}
            </Badge>
          </div>
        </div>
        <div className="space-y-1 p-2">
          <p className="truncate text-xs font-medium">{post.title}</p>
          <AdminPlanLabelsBadges planLabels={post.planLabels} planLabel={post.planLabel} />
          <p className="truncate text-[10px] text-muted-foreground">
            {formatPersianDate(post.publishedDate)} · {formatPersianNumber(post.views)} بازدید
          </p>
          <AdminCreatedAtText createdAt={post.createdAt} />
          <AdminOwnerBadge ownerUserId={post.ownerUserId} ownerName={post.ownerName} />
        </div>
      </button>

      {(canScore || post.score != null || onView || onEdit || onDelete) && (
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
          {(canScore || post.score != null) && (
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
