"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SectionHeader } from "@/components/public/section-header";
import { VideoCard } from "@/components/public/video-card";
import type { MediaCategory, VideoWithVersions } from "@/lib/types";

interface VideosSectionProps {
  categories: MediaCategory[];
  videos: VideoWithVersions[];
}

export function VideosSection({ categories, videos }: VideosSectionProps) {
  const defaultCategory = categories[0]?.id ?? "all";

  return (
    <section id="videos">
      <SectionHeader title="ویدیوها" description="ویدیوهای کمپین — نسخه‌ها داخل هر کارت" />

      {categories.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-xl bg-card">
          ویدیویی ثبت نشده است.
        </div>
      ) : (
        <Tabs defaultValue={defaultCategory}>
          <TabsList className="mb-4">
            {categories.map((cat) => (
              <TabsTrigger key={cat.id} value={cat.id}>{cat.title}</TabsTrigger>
            ))}
          </TabsList>

          {categories.map((cat) => {
            const categoryVideos = videos.filter((v) => v.categoryId === cat.id);
            return (
              <TabsContent key={cat.id} value={cat.id}>
                {categoryVideos.length === 0 ? (
                  <p className="text-muted-foreground text-sm">ویدیویی در این دسته وجود ندارد.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {categoryVideos.map((video) => (
                      <VideoCard key={video.id} title={video.title} description={video.description} versions={video.versions} />
                    ))}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </section>
  );
}
