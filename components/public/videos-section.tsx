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
import { VideoCard } from "@/components/public/video-card";
import {
  PUBLIC_MEDIA_GRID_CLASS,
  sortByPublicMediaOrder,
  type PublicMediaSort,
} from "@/lib/public-media-section";
import type { MediaCategory, VideoWithVersions } from "@/lib/types";
import { cn, formatPersianNumber } from "@/lib/utils";

interface VideosSectionProps {
  categories: MediaCategory[];
  videos: VideoWithVersions[];
}

function getVideoLatestDate(video: VideoWithVersions): string | undefined {
  return [...video.versions].sort((a, b) => b.versionNumber - a.versionNumber)[0]?.date;
}

export function VideosSection({ categories, videos }: VideosSectionProps) {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sort, setSort] = useState<PublicMediaSort>("default");

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.sortOrder - b.sortOrder),
    [categories]
  );

  const filteredVideos = useMemo(() => {
    const filtered =
      categoryFilter === "all"
        ? videos
        : videos.filter((video) => video.categoryId === categoryFilter);
    return sortByPublicMediaOrder(filtered, sort, getVideoLatestDate);
  }, [videos, categoryFilter, sort]);

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
        <div className={PUBLIC_MEDIA_GRID_CLASS}>
          {filteredVideos.map((video) => (
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
    </CollapsibleSection>
  );
}
