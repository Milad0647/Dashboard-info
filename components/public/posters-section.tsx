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
import { PosterCard } from "@/components/public/poster-card";
import {
  PUBLIC_MEDIA_GRID_CLASS,
  sortByPublicMediaOrder,
  type PublicMediaSort,
} from "@/lib/public-media-section";
import { usePublicMediaPagination } from "@/lib/hooks/use-public-media-pagination";
import type { MediaCategory, PosterWithVersions } from "@/lib/types";
import { formatPersianNumber } from "@/lib/utils";

interface PostersSectionProps {
  categories: MediaCategory[];
  posters: PosterWithVersions[];
}

function getPosterLatestDate(poster: PosterWithVersions): string | undefined {
  return [...poster.versions].sort((a, b) => b.versionNumber - a.versionNumber)[0]?.date;
}

export function PostersSection({ categories, posters }: PostersSectionProps) {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sort, setSort] = useState<PublicMediaSort>("default");

  const activeCategories = useMemo(
    () => categories.filter((cat) => posters.some((poster) => poster.categoryId === cat.id)),
    [categories, posters]
  );

  const filteredPosters = useMemo(() => {
    const filtered =
      categoryFilter === "all"
        ? posters
        : posters.filter((poster) => poster.categoryId === categoryFilter);
    return sortByPublicMediaOrder(filtered, sort, getPosterLatestDate);
  }, [posters, categoryFilter, sort]);

  const { visibleCount, hasMore, loadMore } = usePublicMediaPagination(
    filteredPosters.length,
    `${categoryFilter}:${sort}`
  );

  const visiblePosters = filteredPosters.slice(0, visibleCount);

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
          <div className={PUBLIC_MEDIA_GRID_CLASS}>
            {visiblePosters.map((poster) => (
              <PosterCard
                key={poster.id}
                title={poster.title}
                description={poster.description}
                versions={poster.versions}
              />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center">
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
