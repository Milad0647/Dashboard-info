"use client";

import { useMemo, useState } from "react";
import {
  SocialPlatformIcon,
  getSocialPlatformLabel,
} from "@/components/public/social-platform-icon";
import type { DataOwnerGroup, SocialMediaPost, SocialPlatform } from "@/lib/types";
import { formatPersianDate, formatPersianNumber, getStatusLabel } from "@/lib/utils";
import { OwnerGroupedSection } from "@/components/public/owner-grouped-section";
import { CollapsibleSection } from "@/components/public/collapsible-section";
import { SectionTopCompaniesBox } from "@/components/public/section-top-companies-box";
import { VideoThumbnail } from "@/components/media/video-thumbnail";
import { ImageZoom } from "@/components/ui/image-zoom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Eye, Music } from "lucide-react";
import {
  PUBLIC_MEDIA_GRID_CLASS,
  filterGroupsByDisplayContent,
  socialPostHasDisplayContent,
} from "@/lib/public-media-section";
import { usePublicMediaPagination } from "@/lib/hooks/use-public-media-pagination";
import { useCampaignContentReveal } from "@/lib/hooks/use-campaign-content-reveal";
import { useCampaignSectionVisibility } from "@/lib/hooks/use-campaign-section-visibility";
import { useFilteredOwnerGroups } from "@/lib/hooks/use-filtered-owner-groups";
import { flattenOwnerGroupsInSortOrder, shouldRenderChronologically } from "@/lib/owner-groups";
import { useOwnerLocationFilter } from "@/lib/context/owner-location-filter-context";
import { isDirectAudioUrl, isDirectVideoUrl, resolveAbsoluteMediaUrl } from "@/lib/media-utils";
import { ShowMoreButton } from "@/components/public/show-more-button";
import { PublicContentCard } from "@/components/public/public-content-card";
import { PublicContentDetailDialog } from "@/components/public/public-content-detail-dialog";
import { ContentScoreControl } from "@/components/admin/content-score-control";
import { useContentScoreAccess } from "@/lib/context/content-score-context";

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
        imgClassName="object-cover apple-media-zoom"
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 220px"
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
          preload="none"
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
        className="object-cover apple-media-zoom"
      />
    );
  }

  if (post.mediaUrl) {
    return (
      <ImageZoom
        src={post.mediaUrl}
        alt={post.title}
        className="h-full w-full"
        imgClassName="object-cover apple-media-zoom"
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 220px"
      />
    );
  }

  return (
    <div className="flex h-full items-center justify-center bg-muted px-2 text-center text-xs text-muted-foreground">
      {getStatusLabel(post.platform)}
    </div>
  );
}

function SocialPostCard({ post }: { post: SocialMediaPost }) {
  const { canScore, campaignId } = useContentScoreAccess();
  const [detailOpen, setDetailOpen] = useState(false);
  const platformLabel =
    post.platform === "site"
      ? getStatusLabel(post.platform)
      : getSocialPlatformLabel(post.platform as SocialPlatform);
  const category = `${platformLabel} — ${getStatusLabel(post.contentType)}`;
  const topics = post.planLabels ?? (post.planLabel ? [post.planLabel] : []);
  const date = formatPersianDate(post.publishedDate);

  return (
    <>
      <PublicContentCard
        scrollId={post.id}
        title={post.title}
        date={date}
        category={category}
        topics={topics}
        ownerUserId={post.ownerUserId}
        ownerName={post.ownerName}
        media={
          <div className="group relative h-full w-full">
            <SocialPostCover post={post} />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-8">
              <Badge variant="overlay" className="gap-1 px-1.5 py-0 text-[10px]">
                {post.platform !== "site" ? (
                  <SocialPlatformIcon
                    platform={post.platform as SocialPlatform}
                    size="sm"
                    className="h-3.5 w-3.5 rounded"
                  />
                ) : null}
                {platformLabel}
              </Badge>
            </div>
          </div>
        }
        score={
          canScore || post.score != null ? (
            <ContentScoreControl
              campaignId={campaignId || post.campaignId}
              contentType={post.platform === "site" ? "site_publication" : "social_post"}
              contentId={post.id}
              score={post.score}
              canScore={canScore}
              compact
            />
          ) : null
        }
        actions={
          <Button variant="outline" size="sm" onClick={() => setDetailOpen(true)}>
            <Eye className="h-4 w-4" />
            مشاهده
          </Button>
        }
      />

      <PublicContentDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title={post.title}
        category={category}
        topics={topics}
        date={date}
        ownerName={post.ownerName}
        description={post.description}
        media={
          <div className="relative aspect-square w-full overflow-hidden">
            <SocialPostCover post={post} />
          </div>
        }
        extras={
          <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
            <span>بازدید: {formatPersianNumber(post.views)}</span>
            <span>لایک: {formatPersianNumber(post.likes)}</span>
            <span>کامنت: {formatPersianNumber(post.comments)}</span>
            <span>اشتراک: {formatPersianNumber(post.shares)}</span>
          </div>
        }
        actions={
          post.link ? (
            <Button variant="outline" size="sm" asChild>
              <a href={post.link} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                باز کردن لینک
              </a>
            </Button>
          ) : undefined
        }
      />
    </>
  );
}

export function SocialPostsSection({ posts, groups }: SocialPostsSectionProps) {
  const { filter } = useOwnerLocationFilter();
  const locationFilteredGroups = useFilteredOwnerGroups(groups, (post) => post.publishedDate);
  const filteredGroups = useMemo(
    () => filterGroupsByDisplayContent(locationFilteredGroups, socialPostHasDisplayContent),
    [locationFilteredGroups]
  );
  const filteredPosts = useMemo(
    () => flattenOwnerGroupsInSortOrder(filteredGroups, filter.sortOrder),
    [filteredGroups, filter.sortOrder]
  );
  const sectionVisible = useCampaignSectionVisibility(posts.length, filteredPosts.length);

  const { visibleCount, hasMore, loadMore, revealContentId } = usePublicMediaPagination(
    filteredPosts.length,
    `social-posts:${filteredPosts.length}`
  );

  const postIds = useMemo(() => filteredPosts.map((post) => post.id), [filteredPosts]);

  useCampaignContentReveal("social-posts", postIds, (contentId) =>
    revealContentId(contentId, postIds)
  );

  const chronological = shouldRenderChronologically(filter.sortOrder);
  const visibleItems = useMemo(
    () => filteredPosts.slice(0, visibleCount),
    [filteredPosts, visibleCount]
  );
  const visibleGroups = useMemo(() => {
    const visibleIds = new Set(visibleItems.map((post) => post.id));
    return filteredGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((post) => visibleIds.has(post.id)),
      }))
      .filter((group) => group.items.length > 0);
  }, [filteredGroups, visibleItems]);

  if (!sectionVisible) return null;

  return (
    <CollapsibleSection
      id="social-posts"
      title="شبکه‌های اجتماعی"
      description={`${formatPersianNumber(filteredPosts.length)} پست — اینستاگرام، تلگرام و سایر شبکه‌ها`}
    >
      <SectionTopCompaniesBox groups={filteredGroups} contentKind="social_post" />
      <div className="space-y-4">
        <OwnerGroupedSection
          groups={visibleGroups}
          flatItems={chronological ? visibleItems : null}
        >
          {(groupPosts) => (
            <div className={PUBLIC_MEDIA_GRID_CLASS}>
              {groupPosts.map((post) => (
                <SocialPostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </OwnerGroupedSection>

        {hasMore && (
          <ShowMoreButton remaining={filteredPosts.length - visibleCount} onClick={loadMore} />
        )}
      </div>
    </CollapsibleSection>
  );
}
