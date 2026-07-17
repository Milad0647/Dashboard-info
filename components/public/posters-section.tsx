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
import { PosterCard } from "@/components/public/poster-card";
import {
  posterHasDisplayContent,
  PUBLIC_MEDIA_GRID_CLASS,
  resolvePublicMediaSort,
  sortByPublicMediaOrder,
  type PublicMediaSort,
} from "@/lib/public-media-section";
import { usePublicMediaPagination } from "@/lib/hooks/use-public-media-pagination";
import { useFilteredOwnerGroups } from "@/lib/hooks/use-filtered-owner-groups";
import { useCampaignSectionVisibility } from "@/lib/hooks/use-campaign-section-visibility";
import { useOwnerLocationFilter } from "@/lib/context/owner-location-filter-context";
import { flattenOwnerGroupsInSortOrder, shouldRenderChronologically } from "@/lib/owner-groups";
import type { DataOwnerGroup, MediaCategory, PosterWithVersions } from "@/lib/types";
import { formatPersianNumber } from "@/lib/utils";

function getPosterLatestDate(poster: PosterWithVersions): string | undefined {
  return [...poster.versions].sort((a, b) => b.versionNumber - a.versionNumber)[0]?.date;
}

function getPosterSortDate(poster: PosterWithVersions, sort: PublicMediaSort): string | undefined {
  if (sort === "newest" || sort === "oldest") {
    return poster.updatedAt || poster.createdAt;
  }
  return getPosterLatestDate(poster);
}

interface PostersSectionProps {
  categories: MediaCategory[];
  posters: PosterWithVersions[];
  groups: DataOwnerGroup<PosterWithVersions>[];
}

function filterPosterGroups(
  groups: DataOwnerGroup<PosterWithVersions>[],
  categoryFilter: string,
  sort: PublicMediaSort
): DataOwnerGroup<PosterWithVersions>[] {
  return groups
    .map((group) => ({
      ...group,
      items:
        categoryFilter === "all"
          ? sortByPublicMediaOrder(
              group.items.filter((poster) => posterHasDisplayContent(poster)),
              sort,
              (poster) => getPosterSortDate(poster, sort)
            )
          : sortByPublicMediaOrder(
              group.items
                .filter((poster) => poster.categoryId === categoryFilter)
                .filter((poster) => posterHasDisplayContent(poster)),
              sort,
              (poster) => getPosterSortDate(poster, sort)
            ),
    }))
    .filter((group) => group.items.length > 0);
}

export function PostersSection({ categories: _categories, posters, groups }: PostersSectionProps) {
  const categoryFilter = "all";
  const [sort, setSort] = useState<PublicMediaSort>("default");
  const { filter } = useOwnerLocationFilter();

  const locationFilteredGroups = useFilteredOwnerGroups(groups, getPosterLatestDate);
  const effectiveSort = resolvePublicMediaSort(filter.sortOrder, sort);

  const filteredGroups = useMemo(
    () => filterPosterGroups(locationFilteredGroups, categoryFilter, effectiveSort),
    [locationFilteredGroups, effectiveSort]
  );

  const filteredPosters = useMemo(() => {
    if (effectiveSort === "title") {
      return filteredGroups.flatMap((group) => group.items);
    }
    return flattenOwnerGroupsInSortOrder(filteredGroups, effectiveSort);
  }, [filteredGroups, effectiveSort]);
  const sectionVisible = useCampaignSectionVisibility(posters.length, filteredPosters.length);

  const { visibleCount, hasMore, loadMore } = usePublicMediaPagination(
    filteredPosters.length,
    `${categoryFilter}:${sort}`
  );

  const chronological = shouldRenderChronologically(effectiveSort);
  const visibleItems = useMemo(
    () => filteredPosters.slice(0, visibleCount),
    [filteredPosters, visibleCount]
  );
  const visibleGroups = useMemo(() => {
    const visibleIds = new Set(visibleItems.map((poster) => poster.id));
    return filteredGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((poster) => visibleIds.has(poster.id)),
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
      id="posters"
      title="پوسترها"
      description="در مودال مشاهده، بین نسخه‌ها جابه‌جا شوید"
      controls={controls}
    >
      <SectionTopCompaniesBox groups={filteredGroups} />
      <div className="space-y-4">
          <OwnerGroupedSection
            groups={visibleGroups}
            flatItems={chronological ? visibleItems : null}
          >
            {(groupPosters) => (
              <div className={PUBLIC_MEDIA_GRID_CLASS}>
                {groupPosters.map((poster) => (
                  <PosterCard
                    key={poster.id}
                    id={poster.id}
                    campaignId={poster.campaignId}
                    title={poster.title}
                    description={poster.description}
                    versions={poster.versions}
                    score={poster.score}
                    ownerUserId={poster.ownerUserId}
                    ownerName={poster.ownerName}
                  />
                ))}
              </div>
            )}
          </OwnerGroupedSection>

          {hasMore && (
            <div className="flex justify-center" data-export-hide>
              <Button variant="outline" onClick={loadMore}>
                مشاهده بیشتر ({formatPersianNumber(filteredPosters.length - visibleCount)} باقی‌مانده)
              </Button>
            </div>
          )}
        </div>
    </CollapsibleSection>
  );
}
