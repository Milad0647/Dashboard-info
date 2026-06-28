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
import { VideoCard } from "@/components/public/video-card";
import {
  PUBLIC_MEDIA_GRID_CLASS,
  sortByPublicMediaOrder,
  type PublicMediaSort,
} from "@/lib/public-media-section";
import { usePublicMediaPagination } from "@/lib/hooks/use-public-media-pagination";
import { hasUserOwnedGroups } from "@/lib/owner-groups";
import type { DataOwnerGroup, MediaCategory, VideoWithVersions } from "@/lib/types";
import { cn, formatPersianNumber } from "@/lib/utils";

function getVideoLatestDate(video: VideoWithVersions): string | undefined {
  return [...video.versions].sort((a, b) => b.versionNumber - a.versionNumber)[0]?.date;
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
          ? sortByPublicMediaOrder(group.items, sort, getVideoLatestDate)
          : sortByPublicMediaOrder(
              group.items.filter((video) => video.categoryId === categoryFilter),
              sort,
              getVideoLatestDate
            ),
    }))
    .filter((group) => group.items.length > 0);
}

export function VideosSection({ categories, videos, groups }: VideosSectionProps) {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sort, setSort] = useState<PublicMediaSort>("default");

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.sortOrder - b.sortOrder),
    [categories]
  );

  const filteredGroups = useMemo(
    () => filterVideoGroups(groups, categoryFilter, sort),
    [groups, categoryFilter, sort]
  );

  const filteredVideos = useMemo(
    () => filteredGroups.flatMap((group) => group.items),
    [filteredGroups]
  );

  const enablePagination = !hasUserOwnedGroups(filteredGroups);

  const { visibleCount, hasMore, loadMore } = usePublicMediaPagination(
    filteredVideos.length,
    `${categoryFilter}:${sort}`,
    enablePagination
  );

  const visibleGroups = useMemo(() => {
    if (!enablePagination) return filteredGroups;

    const visibleIds = new Set(filteredVideos.slice(0, visibleCount).map((video) => video.id));
    return filteredGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((video) => visibleIds.has(video.id)),
      }))
      .filter((group) => group.items.length > 0);
  }, [enablePagination, filteredGroups, filteredVideos, visibleCount]);

  if (videos.length === 0) return null;

  const controls = (
    <Select value={sort} onValueChange={(value) => setSort(value as PublicMediaSort)}>
      <SelectTrigger className="w-36">
        <SelectValue placeholder="مرتب‌سازی" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="default">ترتیب پیش‌فرض</SelectItem>
        <SelectItem value="title">عنوان</SelectItem>
        <SelectItem value="newest">جدیدترین</SelectItem>
      </SelectContent>
    </Select>
  );

  return (
    <CollapsibleSection
      id="videos"
      title="ویدیوها"
      description={`${formatPersianNumber(videos.length)} ویدیو — همه را ببینید و با دسته فیلتر کنید`}
      controls={controls}
    >
      {sortedCategories.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={categoryFilter === "all" ? "default" : "outline"}
            onClick={() => setCategoryFilter("all")}
          >
            همه ({formatPersianNumber(videos.length)})
          </Button>
          {sortedCategories.map((category) => {
            const count = videos.filter((video) => video.categoryId === category.id).length;

            return (
              <Button
                key={category.id}
                type="button"
                size="sm"
                variant={categoryFilter === category.id ? "default" : "outline"}
                onClick={() => setCategoryFilter(category.id)}
                className={cn(count === 0 && "opacity-60")}
              >
                {category.title} ({formatPersianNumber(count)})
              </Button>
            );
          })}
        </div>
      )}

      {sortedCategories.length > 1 && (
        <div className="mb-4 sm:hidden">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="انتخاب دسته" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه دسته‌ها</SelectItem>
              {sortedCategories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {filteredVideos.length === 0 ? (
        <div className="rounded-xl border bg-card py-12 text-center text-muted-foreground">
          ویدیویی در این دسته یافت نشد.
        </div>
      ) : (
        <div className="space-y-4">
          <OwnerGroupedSection groups={visibleGroups}>
            {(groupVideos) => (
              <div className={PUBLIC_MEDIA_GRID_CLASS}>
                {groupVideos.map((video) => (
                  <VideoCard
                    key={video.id}
                    title={video.title}
                    description={video.description}
                    categoryTitle={video.category?.title}
                    versions={video.versions}
                  />
                ))}
              </div>
            )}
          </OwnerGroupedSection>

          {enablePagination && hasMore && (
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
