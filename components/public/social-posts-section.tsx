import type { DataOwnerGroup, SocialMediaPost } from "@/lib/types";
import { formatPersianDate, formatPersianNumber, getStatusLabel } from "@/lib/utils";
import { OwnerGroupedSection } from "@/components/public/owner-grouped-section";
import { SectionHeader } from "@/components/public/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

interface SocialPostsSectionProps {
  posts: SocialMediaPost[];
  groups: DataOwnerGroup<SocialMediaPost>[];
}

export function SocialPostsSection({ posts, groups }: SocialPostsSectionProps) {
  if (posts.length === 0) return null;

  return (
    <section id="social-posts">
      <SectionHeader
        title="شبکه‌های اجتماعی"
        description="پست‌های ثبت‌شده با جزئیات کانال، بازدید و نوع محتوا"
      />

      <OwnerGroupedSection groups={groups}>
        {(groupPosts) => (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {groupPosts.map((post) => (
              <article key={post.id} className="rounded-xl border bg-card p-4 space-y-3">
                {post.coverImageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.coverImageUrl} alt={post.title} className="w-full h-40 object-cover rounded-lg" />
                )}
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline">{getStatusLabel(post.platform)}</Badge>
                  <Badge variant="secondary">{getStatusLabel(post.contentType)}</Badge>
                </div>
                <h3 className="font-semibold">{post.title}</h3>
                {post.description && (
                  <p className="text-sm text-muted-foreground line-clamp-4">{post.description}</p>
                )}
                <p className="text-sm text-muted-foreground">{formatPersianDate(post.publishedDate)}</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>بازدید: {formatPersianNumber(post.views)}</div>
                  <div>لایک: {formatPersianNumber(post.likes)}</div>
                  <div>کامنت: {formatPersianNumber(post.comments)}</div>
                  <div>اشتراک: {formatPersianNumber(post.shares)}</div>
                </div>
                {post.link && (
                  <Button variant="outline" size="sm" asChild>
                    <a href={post.link} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      مشاهده پست
                    </a>
                  </Button>
                )}
              </article>
            ))}
          </div>
        )}
      </OwnerGroupedSection>
    </section>
  );
}
