"use client";

import { useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CollapsibleSection } from "@/components/public/collapsible-section";
import { OwnerGroupedSection } from "@/components/public/owner-grouped-section";
import { SectionTopCompaniesBox } from "@/components/public/section-top-companies-box";
import { VideoCard } from "@/components/public/video-card";
import {
  videoHasDisplayContent,
  PUBLIC_MEDIA_GRID_CLASS,
  resolvePublicMediaSort,
  sortByPublicMediaOrder,
  type PublicMediaSort,
} from "@/lib/public-media-section";
import { usePublicMediaPagination } from "@/lib/hooks/use-public-media-pagination";
import { useCampaignContentReveal } from "@/lib/hooks/use-campaign-content-reveal";
import { useFilteredOwnerGroups } from "@/lib/hooks/use-filtered-owner-groups";
import { useCampaignSectionVisibility } from "@/lib/hooks/use-campaign-section-visibility";
import { useOwnerLocationFilter } from "@/lib/context/owner-location-filter-context";
import { flattenOwnerGroupsInSortOrder, shouldRenderChronologically } from "@/lib/owner-groups";
import type { DataOwnerGroup, MediaCategory, VideoWithVersions } from "@/lib/types";
import { formatPersianNumber } from "@/lib/utils";

function getVideoLatestDate(video: VideoWithVersions): string | undefined {
  return [...video.versions].sort((a, b) => b.versionNumber - a.versionNumber)[0]?.date;
}

function getVideoSortDate(video: VideoWithVersions, sort: PublicMediaSort): string | undefined {
  if (sort === "newest" || sort === "oldest") {
    return video.updatedAt || video.createdAt;
  }
  return getVideoLatestDate(video);
}

interface VideosSectionProps {
  categories: MediaCategory[];
  videos: VideoWithVersions[];
  groups: DataOwnerGroup<VideoWithVersions>[];
}

function filterVideoGroups(
  groups: DataOwnerGroup<VideoWithVersions>[],
  categoryFilter: string,
  sort: PublicMediaSort
): DataOwnerGroup<VideoWithVersions>[] {
  return groups
    .map((group) => ({
      ...group,
      items:
        categoryFilter === "all"
          ? sortByPublicMediaOrder(
              group.items.filter((video) => videoHasDisplayContent(video)),
              sort,
              (video) => getVideoSortDate(video, sort)
            )
          : sortByPublicMediaOrder(
              group.items
                .filter((video) => video.categoryId === categoryFilter)
                .filter((video) => videoHasDisplayContent(video)),
              sort,
              (video) => getVideoSortDate(video, sort)
            ),
    }))
    .filter((group) => group.items.length > 0);
}

export function VideosSection({ categories: _categories, videos, groups }: VideosSectionProps) {
  // Category filter UI removed; always show all items.
  const categoryFilter = "all";
  const [sort, setSort] = useState<PublicMediaSort>("default");
  const { filter } = useOwnerLocationFilter();

  const locationFilteredGroups = useFilteredOwnerGroups(groups, getVideoLatestDate);
  const effectiveSort = resolvePublicMediaSort(filter.sortOrder, sort);

  const filteredGroups = useMemo(
    () => filterVideoGroups(locationFilteredGroups, categoryFilter, effectiveSort),
    [locationFilteredGroups, effectiveSort]
  );

  const filteredVideos = useMemo(() => {
    if (effectiveSort === "title") {
      return filteredGroups.flatMap((group) => group.items);
    }
    return flattenOwnerGroupsInSortOrder(filteredGroups, effectiveSort);
  }, [filteredGroups, effectiveSort]);
  const sectionVisible = useCampaignSectionVisibility(videos.length, filteredVideos.length);

  const { visibleCount, hasMore, loadMore, revealContentId } = usePublicMediaPagination(
    filteredVideos.length,
    `${categoryFilter}:${sort}`
  );

  const videoIds = useMemo(() => filteredVideos.map((video) => video.id), [filteredVideos]);

  useCampaignContentReveal("videos", videoIds, (contentId) =>
    revealContentId(contentId, videoIds)
  );

  const chronological = shouldRenderChronologically(effectiveSort);
  const visibleItems = useMemo(
    () => filteredVideos.slice(0, visibleCount),
    [filteredVideos, visibleCount]
  );
  const visibleGroups = useMemo(() => {
    const visibleIds = new Set(visibleItems.map((video) => video.id));
    return filteredGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((video) => visibleIds.has(video.id)),
      }))
      .filter((group) => group.items.length > 0);
  }, [filteredGroups, visibleItems]);

  if (!sectionVisible) return null;

  const controls = filter.sortOrder === "default" ? (
    <Select value={sort} onValueChange={(value) => setSort(value as PublicMediaSort)}>
      <SelectTrigger className="w-36">
        <SelectValue placeholder="مرتب‌سازی" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="default">ترتیب پیش‌فرض</SelectItem>
        <SelectItem value="title">عنوان</SelectItem>
        <SelectItem value="newest">جدیدترین</SelectItem>
        <SelectItem value="oldest">قدیمی‌ترین</SelectItem>
      </SelectContent>
    </Select>
  ) : null;

  return (
    <CollapsibleSection
      id="videos"
      title="ویدیوها"
      description={`${formatPersianNumber(videos.length)} ویدیو`}
      controls={controls}
    >
      <SectionTopCompaniesBox groups={filteredGroups} contentKind="video" />
      {filteredVideos.length === 0 ? (
        <div className="rounded-xl border bg-card py-12 text-center text-muted-foreground">
          ویدیویی یافت نشد.
        </div>
      ) : (
        <div className="space-y-4">
          <OwnerGroupedSection
            groups={visibleGroups}
            flatItems={chronological ? visibleItems : null}
          >
            {(groupVideos) => (
              <div className={PUBLIC_MEDIA_GRID_CLASS}>
                {groupVideos.map((video) => (
                  <VideoCard
                    key={video.id}
                    id={video.id}
                    campaignId={video.campaignId}
                    title={video.title}
                    description={video.description}
                    versions={video.versions}
                    score={video.score}
                    ownerUserId={video.ownerUserId}
                    ownerName={video.ownerName}
                    category={video.category?.title}
                    topics={video.planLabels ?? (video.planLabel ? [video.planLabel] : [])}
                    createdAt={video.createdAt}
                  />
                ))}
              </div>
            )}
          </OwnerGroupedSection>

          {hasMore && (
            <div className="flex justify-center" data-export-hide>
              <Button variant="outline" onClick={loadMore}>
                مشاهده بیشتر ({formatPersianNumber(filteredVideos.length - visibleCount)} باقی‌مانده)
              </Button>
            </div>
          )}
        </div>
      )}
    </CollapsibleSection>
  );
}
