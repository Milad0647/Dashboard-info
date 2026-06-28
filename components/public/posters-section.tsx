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
import { PosterCard } from "@/components/public/poster-card";
import {
  PUBLIC_MEDIA_GRID_CLASS,
  sortByPublicMediaOrder,
  type PublicMediaSort,
} from "@/lib/public-media-section";
import { usePublicMediaPagination } from "@/lib/hooks/use-public-media-pagination";
import { hasUserOwnedGroups } from "@/lib/owner-groups";
import type { DataOwnerGroup, MediaCategory, PosterWithVersions } from "@/lib/types";
import { formatPersianNumber } from "@/lib/utils";

function getPosterLatestDate(poster: PosterWithVersions): string | undefined {
  return [...poster.versions].sort((a, b) => b.versionNumber - a.versionNumber)[0]?.date;
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
          ? sortByPublicMediaOrder(group.items, sort, getPosterLatestDate)
          : sortByPublicMediaOrder(
              group.items.filter((poster) => poster.categoryId === categoryFilter),
              sort,
              getPosterLatestDate
            ),
    }))
    .filter((group) => group.items.length > 0);
}

export function PostersSection({ categories, posters, groups }: PostersSectionProps) {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sort, setSort] = useState<PublicMediaSort>("default");

  const activeCategories = useMemo(
    () => categories.filter((cat) => posters.some((poster) => poster.categoryId === cat.id)),
    [categories, posters]
  );

  const filteredGroups = useMemo(
    () => filterPosterGroups(groups, categoryFilter, sort),
    [groups, categoryFilter, sort]
  );

  const filteredPosters = useMemo(
    () => filteredGroups.flatMap((group) => group.items),
    [filteredGroups]
  );

  const enablePagination = !hasUserOwnedGroups(filteredGroups);

  const { visibleCount, hasMore, loadMore } = usePublicMediaPagination(
    filteredPosters.length,
    `${categoryFilter}:${sort}`,
    enablePagination
  );

  const visibleGroups = useMemo(() => {
    if (!enablePagination) return filteredGroups;

    const visibleIds = new Set(filteredPosters.slice(0, visibleCount).map((poster) => poster.id));
    return filteredGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((poster) => visibleIds.has(poster.id)),
      }))
      .filter((group) => group.items.length > 0);
  }, [enablePagination, filteredGroups, filteredPosters, visibleCount]);
  if (posters.length === 0) return null;

  const controls = (
    <>
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
      {activeCategories.length > 0 && (
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="دسته" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه دسته‌ها</SelectItem>
            {activeCategories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </>
  );

  return (
    <CollapsibleSection
      id="posters"
      title="پوسترها"
      description="در مودال مشاهده، بین نسخه‌ها جابه‌جا شوید"
      controls={controls}
    >
      {filteredPosters.length === 0 ? (
        <div className="rounded-xl border bg-card py-12 text-center text-muted-foreground">
          پوستری در این دسته یافت نشد.
        </div>
      ) : (
        <div className="space-y-4">
          <OwnerGroupedSection groups={visibleGroups}>
            {(groupPosters) => (
              <div className={PUBLIC_MEDIA_GRID_CLASS}>
                {groupPosters.map((poster) => (
                  <PosterCard
                    key={poster.id}
                    title={poster.title}
                    description={poster.description}
                    versions={poster.versions}
                  />
                ))}
              </div>
            )}
          </OwnerGroupedSection>

          {enablePagination && hasMore && (              <div className="flex justify-center" data-export-hide>
                <Button variant="outline" onClick={loadMore}>
                مشاهده بیشتر ({formatPersianNumber(filteredPosters.length - visibleCount)} باقی‌مانده)
              </Button>
            </div>
          )}
        </div>
      )}
    </CollapsibleSection>
  );
}
