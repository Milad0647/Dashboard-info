"use client";

import { useMemo } from "react";
import type { DataOwnerGroup, SocialMediaPost } from "@/lib/types";
import { formatPersianDate, formatPersianNumber, getStatusLabel } from "@/lib/utils";
import { OwnerGroupedSection } from "@/components/public/owner-grouped-section";
import { CollapsibleSection } from "@/components/public/collapsible-section";
import { SectionTopCompaniesBox } from "@/components/public/section-top-companies-box";
import { VideoThumbnail } from "@/components/media/video-thumbnail";
import { ImageZoom } from "@/components/ui/image-zoom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ExternalLink, Music } from "lucide-react";
import { PUBLIC_MEDIA_GRID_CLASS } from "@/lib/public-media-section";
import { usePublicMediaPagination } from "@/lib/hooks/use-public-media-pagination";
import { useCampaignSectionVisibility } from "@/lib/hooks/use-campaign-section-visibility";
import { useFilteredOwnerGroups } from "@/lib/hooks/use-filtered-owner-groups";
import { flattenOwnerGroupsInSortOrder } from "@/lib/owner-groups";
import { useOwnerLocationFilter } from "@/lib/context/owner-location-filter-context";
import { isDirectAudioUrl, isDirectVideoUrl, resolveAbsoluteMediaUrl } from "@/lib/media-utils";
import { ShowMoreButton } from "@/components/public/show-more-button";

interface SocialPostsSectionProps {
  posts: SocialMediaPost[];
  groups: DataOwnerGroup<SocialMediaPost>[];
}

function SocialPostCover({ post }: { post: SocialMediaPost }) {
  if (post.coverImageUrl) {
    return (
      <ImageZoom
        src={post.coverImageUrl}
        alt={post.title}
        className="h-full w-full"
        imgClassName="transition-transform group-hover:scale-105"
      />
    );
  }

  const isAudio =
    post.contentType === "audio" || (Boolean(post.mediaUrl) && isDirectAudioUrl(post.mediaUrl!));

  if (isAudio && post.mediaUrl) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-muted px-3 py-4">
        <Music className="h-8 w-8 text-muted-foreground" />
        <audio
          src={resolveAbsoluteMediaUrl(post.mediaUrl)}
          controls
          preload="metadata"
          className="w-full max-w-full"
          onClick={(event) => event.stopPropagation()}
        />
      </div>
    );
  }

  if (post.mediaUrl && (post.contentType === "video" || isDirectVideoUrl(post.mediaUrl))) {
    return (
      <VideoThumbnail
        videoUrl={post.mediaUrl}
        alt={post.title}
        className="object-cover transition-transform group-hover:scale-105"
      />
    );
  }

  if (post.mediaUrl) {
    return (
      <ImageZoom
        src={post.mediaUrl}
        alt={post.title}
        className="h-full w-full"
        imgClassName="transition-transform group-hover:scale-105"
      />
    );
  }

  return (
    <div className="flex h-full items-center justify-center bg-muted text-xs text-muted-foreground px-2 text-center">
      {getStatusLabel(post.platform)}
    </div>
  );
}

function SocialPostCard({ post }: { post: SocialMediaPost }) {
  const titleContent = post.link ? (
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
  );

  return (
    <Card className="h-full w-full overflow-hidden py-0 gap-0">
      <div className="group relative aspect-video overflow-hidden bg-muted">
        <SocialPostCover post={post} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-6">
          <div className="flex flex-wrap items-center gap-1">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 text-white bg-white/20 border-0">
              {getStatusLabel(post.platform)}
            </Badge>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 text-white bg-white/20 border-0">
              {getStatusLabel(post.contentType)}
            </Badge>
          </div>
        </div>
        {post.link && (
          <a
            href={post.link}
            target="_blank"
            rel="noreferrer"
            className="absolute top-2 left-2 rounded-md bg-black/50 p-1.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
            aria-label="مشاهده پست"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      <CardContent className="space-y-1 p-2.5">
        <h3 className="line-clamp-2 text-xs font-semibold leading-snug">{titleContent}</h3>
        <p className="text-[10px] text-muted-foreground">{formatPersianDate(post.publishedDate)}</p>
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground">
          <span>بازدید: {formatPersianNumber(post.views)}</span>
          <span>لایک: {formatPersianNumber(post.likes)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function SocialPostsSection({ posts, groups }: SocialPostsSectionProps) {
  const { filter } = useOwnerLocationFilter();
  const filteredGroups = useFilteredOwnerGroups(groups, (post) => post.publishedDate);
  const filteredPosts = useMemo(
    () => flattenOwnerGroupsInSortOrder(filteredGroups, filter.sortOrder),
    [filteredGroups, filter.sortOrder]
  );
  const sectionVisible = useCampaignSectionVisibility(posts.length, filteredPosts.length);

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

  if (!sectionVisible) return null;

  return (
    <CollapsibleSection
      id="social-posts"
      title="شبکه‌های اجتماعی"
      description={`${formatPersianNumber(filteredPosts.length)} پست — اینستاگرام، تلگرام و سایر شبکه‌ها`}
    >
      <SectionTopCompaniesBox groups={filteredGroups} />
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
          <ShowMoreButton
            remaining={filteredPosts.length - visibleCount}
            onClick={loadMore}
          />
        )}
      </div>
    </CollapsibleSection>
  );
}
