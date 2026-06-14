"use client";

import { useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionHeader } from "@/components/public/section-header";
import { VideoCard } from "@/components/public/video-card";
import type { MediaCategory, VideoWithVersions } from "@/lib/types";

interface VideosSectionProps {
  categories: MediaCategory[];
  videos: VideoWithVersions[];
}

export function VideosSection({ categories, videos }: VideosSectionProps) {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const activeCategories = useMemo(
    () => categories.filter((cat) => videos.some((video) => video.categoryId === cat.id)),
    [categories, videos]
  );

  const filteredVideos = useMemo(() => {
    if (categoryFilter === "all") return videos;
    return videos.filter((video) => video.categoryId === categoryFilter);
  }, [videos, categoryFilter]);

  if (videos.length === 0) {
    return (
      <section id="videos">
        <SectionHeader title="ویدیوها" description="ویدیوهای کمپین — نسخه‌ها داخل هر کارت" />
        <div className="rounded-xl border bg-card py-12 text-center text-muted-foreground">
          ویدیویی ثبت نشده است.
        </div>
      </section>
    );
  }

  return (
    <section id="videos">
      <SectionHeader title="ویدیوها" description="همه ویدیوهای کمپین — نسخه‌ها داخل هر کارت">
        {activeCategories.length > 1 && (
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="دسته" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه دسته‌ها</SelectItem>
              {activeCategories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>{cat.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </SectionHeader>

      {filteredVideos.length === 0 ? (
        <div className="rounded-xl border bg-card py-12 text-center text-muted-foreground">
          ویدیویی در این دسته یافت نشد.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredVideos.map((video) => (
            <VideoCard
              key={video.id}
              title={video.title}
              description={video.description}
              versions={video.versions}
            />
          ))}
        </div>
      )}
    </section>
  );
}
