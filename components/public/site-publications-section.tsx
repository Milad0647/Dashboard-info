"use client";

import { useMemo } from "react";
import { ExternalLink, Globe } from "lucide-react";
import type { DataOwnerGroup, SocialMediaPost } from "@/lib/types";
import { formatPersianDate } from "@/lib/utils";
import { CollapsibleSection } from "@/components/public/collapsible-section";
import { OwnerGroupedSection } from "@/components/public/owner-grouped-section";
import { SectionTopCompaniesBox } from "@/components/public/section-top-companies-box";
import { useFilteredOwnerGroups } from "@/lib/hooks/use-filtered-owner-groups";
import { useCampaignSectionVisibility } from "@/lib/hooks/use-campaign-section-visibility";
import { flattenOwnerGroupsInSortOrder, shouldRenderChronologically } from "@/lib/owner-groups";
import { useOwnerLocationFilter } from "@/lib/context/owner-location-filter-context";
import { ShowMoreButton } from "@/components/public/show-more-button";
import { useSectionPagination } from "@/lib/hooks/use-section-pagination";
import { Badge } from "@/components/ui/badge";
import { ImageZoom } from "@/components/ui/image-zoom";
import { PublicOwnerTag } from "@/components/public/public-owner-tag";
import { filterGroupsByDisplayContent, socialPostHasDisplayContent } from "@/lib/public-media-section";

const PUBLICATIONS_ITEMS_PER_ROW = 1;

interface SitePublicationsSectionProps {
  publications: SocialMediaPost[];
  groups: DataOwnerGroup<SocialMediaPost>[];
}

function PublicationList({ items }: { items: SocialMediaPost[] }) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <article
          key={item.id}
          className="rounded-xl border bg-card p-4 flex flex-col sm:flex-row gap-4"
        >
          {item.coverImageUrl && (
            <div className="relative w-full sm:w-40 h-28 shrink-0 rounded-lg overflow-hidden bg-muted">
              <ImageZoom
                src={item.coverImageUrl}
                alt={item.title}
                className="h-full w-full"
                imgClassName="object-cover"
                sizes="160px"
                quality={60}
              />
            </div>
          )}

          <div className="flex-1 space-y-2 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Globe className="h-3.5 w-3.5" />
                منتشرشده در سایت
              </Badge>
              <PublicOwnerTag ownerUserId={item.ownerUserId} ownerName={item.ownerName} />
              <span className="text-sm text-muted-foreground">{formatPersianDate(item.publishedDate)}</span>
            </div>

            {item.link ? (
              <a
                href={item.link}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-primary hover:underline inline-flex items-center gap-1.5 break-words"
              >
                {item.title}
                <ExternalLink className="h-4 w-4 shrink-0" />
              </a>
            ) : (
              <h3 className="font-semibold">{item.title}</h3>
            )}

            {item.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

export function SitePublicationsSection({ publications, groups }: SitePublicationsSectionProps) {
  const { filter } = useOwnerLocationFilter();
  const locationFilteredGroups = useFilteredOwnerGroups(groups, (item) => item.publishedDate);
  const filteredGroups = useMemo(
    () => filterGroupsByDisplayContent(locationFilteredGroups, socialPostHasDisplayContent),
    [locationFilteredGroups]
  );
  const filteredPublications = useMemo(
    () => flattenOwnerGroupsInSortOrder(filteredGroups, filter.sortOrder),
    [filteredGroups, filter.sortOrder]
  );
  const sectionVisible = useCampaignSectionVisibility(publications.length, filteredPublications.length);

  const { effectiveCount, hasMore, loadMore } = useSectionPagination(
    filteredPublications.length,
    PUBLICATIONS_ITEMS_PER_ROW,
    3,
    `site-publications:${filteredPublications.length}`
  );

  const chronological = shouldRenderChronologically(filter.sortOrder);
  const visibleItems = useMemo(
    () => filteredPublications.slice(0, effectiveCount),
    [filteredPublications, effectiveCount]
  );
  const visibleGroups = useMemo(() => {
    const ids = new Set(visibleItems.map((item) => item.id));
    return filteredGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => ids.has(item.id)),
      }))
      .filter((group) => group.items.length > 0);
  }, [filteredGroups, visibleItems]);

  if (!sectionVisible) return null;

  return (
    <CollapsibleSection
      id="site-publications"
      title="انتشار در سایت"
      description="مطالب منتشرشده در سایت کمپین — عنوان هر مورد لینک مستقیم به صفحه است"
    >
      <SectionTopCompaniesBox groups={filteredGroups} />
      {filteredPublications.length === 0 ? (
        <div className="rounded-xl border bg-card py-12 text-center text-muted-foreground">
          مطلبی با فیلتر انتخاب‌شده یافت نشد.
        </div>
      ) : (
        <div className="space-y-4">
          <OwnerGroupedSection
            groups={visibleGroups}
            flatItems={chronological ? visibleItems : null}
          >
            {(groupItems) => <PublicationList items={groupItems} />}
          </OwnerGroupedSection>

          {hasMore && (
            <ShowMoreButton
              remaining={filteredPublications.length - effectiveCount}
              onClick={loadMore}
            />
          )}
        </div>
      )}
    </CollapsibleSection>
  );
}
