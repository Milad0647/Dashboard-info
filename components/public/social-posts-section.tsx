"use client";

import { useMemo } from "react";
import type { DataOwnerGroup, SocialMediaPost } from "@/lib/types";
import { formatPersianDate, formatPersianNumber, getStatusLabel } from "@/lib/utils";
import { OwnerGroupedSection } from "@/components/public/owner-grouped-section";
import { CollapsibleSection } from "@/components/public/collapsible-section";
import { VideoThumbnail } from "@/components/media/video-thumbnail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import {
  PUBLIC_MEDIA_GRID_CLASS,
} from "@/lib/public-media-section";
import { usePublicMediaPagination } from "@/lib/hooks/use-public-media-pagination";
import { useFilteredOwnerGroups } from "@/lib/hooks/use-filtered-owner-groups";
import { isDirectVideoUrl } from "@/lib/media-utils";

interface SocialPostsSectionProps {
  posts: SocialMediaPost[];
  groups: DataOwnerGroup<SocialMediaPost>[];
}

function SocialPostCover({ post }: { post: SocialMediaPost }) {
  if (post.coverImageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={post.coverImageUrl} alt={post.title} className="h-full w-full object-cover" />
    );
  }

  if (post.mediaUrl && (post.contentType === "video" || isDirectVideoUrl(post.mediaUrl))) {
    return (
      <VideoThumbnail
        videoUrl={post.mediaUrl}
        alt={post.title}
        className="object-cover"
      />
    );
  }

  if (post.mediaUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={post.mediaUrl} alt={post.title} className="h-full w-full object-cover" />
    );
  }

  return (
    <div className="flex h-full items-center justify-center bg-muted text-xs text-muted-foreground px-2 text-center">
      {getStatusLabel(post.platform)}
    </div>
  );
}

function SocialPostCard({ post }: { post: SocialMediaPost }) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl border bg-card">
      <div className="relative aspect-video bg-muted">
        <SocialPostCover post={post} />
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {getStatusLabel(post.platform)}
          </Badge>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {getStatusLabel(post.contentType)}
          </Badge>
        </div>

        <h3 className="text-sm font-semibold line-clamp-2 leading-snug">
          {post.link ? (
            <a
              href={post.link}
              target="_blank"
              rel="noreferrer"
              className="hover:text-primary hover:underline"
            >
              {post.title}
            </a>
          ) : (
            post.title
          )}
        </h3>

        <p className="text-[11px] text-muted-foreground">{formatPersianDate(post.publishedDate)}</p>

        <div className="mt-auto grid grid-cols-2 gap-1 text-[10px] text-muted-foreground">
          <span>بازدید: {formatPersianNumber(post.views)}</span>
          <span>لایک: {formatPersianNumber(post.likes)}</span>
          <span>کامنت: {formatPersianNumber(post.comments)}</span>
          <span>اشتراک: {formatPersianNumber(post.shares)}</span>
        </div>

        {post.link && (
          <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
            <a href={post.link} target="_blank" rel="noreferrer">
              <ExternalLink className="h-3 w-3" />
              مشاهده
            </a>
          </Button>
        )}
      </div>
    </article>
  );
}

export function SocialPostsSection({ posts, groups }: SocialPostsSectionProps) {
  const filteredGroups = useFilteredOwnerGroups(groups);
  const filteredPosts = useMemo(
    () => filteredGroups.flatMap((group) => group.items),
    [filteredGroups]
  );

  const { visibleCount, hasMore, loadMore } = usePublicMediaPagination(
    filteredPosts.length,
    `social-posts:${filteredPosts.length}`
  );

  const visibleGroups = useMemo(() => {
    const visibleIds = new Set(filteredPosts.slice(0, visibleCount).map((post) => post.id));
    return filteredGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((post) => visibleIds.has(post.id)),
      }))
      .filter((group) => group.items.length > 0);
  }, [filteredGroups, filteredPosts, visibleCount]);

  if (posts.length === 0) return null;

  return (
    <CollapsibleSection
      id="social-posts"
      title="شبکه‌های اجتماعی"
      description={`${formatPersianNumber(posts.length)} پست — اینستاگرام، تلگرام و سایر شبکه‌ها`}
    >
      {filteredPosts.length === 0 ? (
        <div className="rounded-xl border bg-card py-12 text-center text-muted-foreground">
          پستی با فیلتر انتخاب‌شده یافت نشد.
        </div>
      ) : (
        <div className="space-y-4">
          <OwnerGroupedSection groups={visibleGroups}>
            {(groupPosts) => (
              <div className={PUBLIC_MEDIA_GRID_CLASS}>
                {groupPosts.map((post) => (
                  <SocialPostCard key={post.id} post={post} />
                ))}
              </div>
            )}
          </OwnerGroupedSection>

          {hasMore && (
            <div className="flex justify-center" data-export-hide>
              <Button variant="outline" onClick={loadMore}>
                مشاهده بیشتر ({formatPersianNumber(filteredPosts.length - visibleCount)} باقی‌مانده)
              </Button>
            </div>
          )}
        </div>
      )}
    </CollapsibleSection>
  );
}
