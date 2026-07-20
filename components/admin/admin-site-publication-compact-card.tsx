"use client";

import { Globe } from "lucide-react";
import { AdminCreatedAtText } from "@/components/admin/admin-created-at";
import { AdminItemActions } from "@/components/admin/admin-item-actions";
import { AdminOwnerBadge } from "@/components/admin/admin-owner-badge";
import { AdminPlanLabelsBadges } from "@/components/admin/admin-plan-labels-badges";
import { MediaThumbnail } from "@/components/ui/media-thumbnail";
import type { SocialMediaPost } from "@/lib/types";
import { cn, formatPersianDate } from "@/lib/utils";

interface AdminSitePublicationCompactCardProps {
  post: SocialMediaPost;
  onClick: () => void;
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function AdminSitePublicationCompactCard({
  post,
  onClick,
  onView,
  onEdit,
  onDelete,
}: AdminSitePublicationCompactCardProps) {
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
          {post.coverImageUrl ? (
            <MediaThumbnail
              src={post.coverImageUrl}
              alt={post.title}
              kind="poster"
              sizes="200px"
              objectFit="cover"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-2 text-muted-foreground">
              <Globe className="h-8 w-8 opacity-50" />
              <span className="line-clamp-2 text-center text-xs">{post.title}</span>
            </div>
          )}
        </div>
        <div className="space-y-1 p-2">
          <p className="truncate text-xs font-medium">{post.title}</p>
          <AdminPlanLabelsBadges planLabels={post.planLabels} planLabel={post.planLabel} />
          <p className="truncate text-[10px] text-muted-foreground">
            {formatPersianDate(post.publishedDate)}
          </p>
          <AdminCreatedAtText createdAt={post.createdAt} />
          <AdminOwnerBadge ownerUserId={post.ownerUserId} ownerName={post.ownerName} />
        </div>
      </button>

      {(onView || onEdit || onDelete) && (
        <div className="absolute bottom-2 left-2 z-10">
          <AdminItemActions compact onView={onView} onEdit={onEdit} onDelete={onDelete} />
        </div>
      )}
    </div>
  );
}
