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
import { PosterCard } from "@/components/public/poster-card";
import type { MediaCategory, PosterWithVersions } from "@/lib/types";

interface PostersSectionProps {
  categories: MediaCategory[];
  posters: PosterWithVersions[];
}

export function PostersSection({ categories, posters }: PostersSectionProps) {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const activeCategories = useMemo(
    () => categories.filter((cat) => posters.some((poster) => poster.categoryId === cat.id)),
    [categories, posters]
  );

  const filteredPosters = useMemo(() => {
    if (categoryFilter === "all") return posters;
    return posters.filter((poster) => poster.categoryId === categoryFilter);
  }, [posters, categoryFilter]);

  if (posters.length === 0) return null;

  return (
    <section id="posters">
      <SectionHeader
        title="پوسترها"
        description="همه پوسترهای کمپین — روی هر پوستر کلیک کنید و نسخه‌های قبلی را در کارت ببینید"
      >
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

      {filteredPosters.length === 0 ? (
        <div className="rounded-xl border bg-card py-12 text-center text-muted-foreground">
          پوستری در این دسته یافت نشد.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredPosters.map((poster) => (
            <PosterCard
              key={poster.id}
              title={poster.title}
              description={poster.description}
              versions={poster.versions}
            />
          ))}
        </div>
      )}
    </section>
  );
}
