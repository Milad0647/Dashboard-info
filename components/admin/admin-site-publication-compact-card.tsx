"use client";

import { Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AdminOwnerBadge } from "@/components/admin/admin-owner-badge";
import { MediaThumbnail } from "@/components/ui/media-thumbnail";
import type { SocialMediaPost } from "@/lib/types";
import { cn, formatPersianDate } from "@/lib/utils";

interface AdminSitePublicationCompactCardProps {
  post: SocialMediaPost;
  onClick: () => void;
}

export function AdminSitePublicationCompactCard({ post, onClick }: AdminSitePublicationCompactCardProps) {
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
        {post.coverImageUrl ? (
          <MediaThumbnail src={post.coverImageUrl} alt={post.title} kind="poster" sizes="200px" objectFit="cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-2 text-muted-foreground">
            <Globe className="h-8 w-8 opacity-50" />
            <span className="line-clamp-2 text-center text-xs">{post.title}</span>
          </div>
        )}
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
        <p className="truncate text-[10px] text-muted-foreground">{formatPersianDate(post.publishedDate)}</p>
        <AdminOwnerBadge ownerUserId={post.ownerUserId} ownerName={post.ownerName} />
      </div>
    </button>
  );
}
