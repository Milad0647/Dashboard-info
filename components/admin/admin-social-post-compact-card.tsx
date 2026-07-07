"use client";

import { Badge } from "@/components/ui/badge";
import { AdminOwnerBadge } from "@/components/admin/admin-owner-badge";
import { MediaThumbnail } from "@/components/ui/media-thumbnail";
import type { SocialMediaPost } from "@/lib/types";
import { cn, formatPersianDate, formatPersianNumber, getStatusLabel } from "@/lib/utils";

interface AdminSocialPostCompactCardProps {
  post: SocialMediaPost;
  onClick: () => void;
}

export function AdminSocialPostCompactCard({ post, onClick }: AdminSocialPostCompactCardProps) {
  const coverUrl = post.coverImageUrl ?? post.mediaUrl ?? null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group w-full overflow-hidden rounded-xl border bg-card text-right transition-all",
        "hover:border-primary hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {getStatusLabel(post.platform)}
          </Badge>
        </div>
        {!post.published && (
          <div className="absolute top-1.5 left-1.5">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              پیش‌نویس
            </Badge>
          </div>
        )}
      </div>
      <div className="space-y-1 p-2">
        <p className="truncate text-xs font-medium">{post.title}</p>
        <p className="truncate text-[10px] text-muted-foreground">
          {formatPersianDate(post.publishedDate)} — {formatPersianNumber(post.views)} بازدید
        </p>
        <AdminOwnerBadge ownerUserId={post.ownerUserId} ownerName={post.ownerName} />
      </div>
    </button>
  );
}
