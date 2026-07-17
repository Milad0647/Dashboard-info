"use client";

import { useMemo } from "react";
import type { BroadcastReport, DataOwnerGroup } from "@/lib/types";
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
import { Button } from "@/components/ui/button";
import { Download, Eye, FileText } from "lucide-react";
import { PublicContentCard } from "@/components/public/public-content-card";
import {
  broadcastHasDisplayContent,
  filterGroupsByDisplayContent,
  PUBLIC_MEDIA_GRID_CLASS,
} from "@/lib/public-media-section";
import { ContentScoreControl } from "@/components/admin/content-score-control";
import { useContentScoreAccess } from "@/lib/context/content-score-context";

const BROADCAST_ITEMS_PER_ROW = 1;

interface BroadcastSectionProps {
  reports: BroadcastReport[];
  groups: DataOwnerGroup<BroadcastReport>[];
}

function BroadcastReportCard({ report }: { report: BroadcastReport }) {
  const { canScore, campaignId } = useContentScoreAccess();

  return (
    <PublicContentCard
      title={report.title}
      date={formatPersianDate(report.reportDate)}
      category="گزارش PDF"
      topics={report.planLabels ?? (report.planLabel ? [report.planLabel] : [])}
      ownerUserId={report.ownerUserId}
      ownerName={report.ownerName}
      media={
        <div className="flex h-full flex-col items-center justify-center gap-3 bg-muted">
          <FileText className="h-16 w-16 text-primary" />
          <span className="text-xs text-muted-foreground">PDF</span>
        </div>
      }
      score={
        canScore || report.score != null ? (
          <ContentScoreControl
            campaignId={campaignId || report.campaignId}
            contentType="broadcast"
            contentId={report.id}
            score={report.score}
            canScore={canScore}
            compact
          />
        ) : null
      }
      actions={
        <>
          <Button variant="outline" size="sm" asChild>
            <a href={report.pdfUrl} target="_blank" rel="noreferrer">
              <Eye className="h-4 w-4" />
              مشاهده
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href={report.pdfUrl} download={report.fileName}>
              <Download className="h-4 w-4" />
              دانلود
            </a>
          </Button>
        </>
      }
    />
  );
}

export function BroadcastSection({ reports, groups }: BroadcastSectionProps) {
  const { filter } = useOwnerLocationFilter();
  const locationFilteredGroups = useFilteredOwnerGroups(groups, (report) => report.reportDate);
  const filteredGroups = useMemo(
    () => filterGroupsByDisplayContent(locationFilteredGroups, broadcastHasDisplayContent),
    [locationFilteredGroups]
  );
  const filteredReports = useMemo(
    () => flattenOwnerGroupsInSortOrder(filteredGroups, filter.sortOrder),
    [filteredGroups, filter.sortOrder]
  );
  const sectionVisible = useCampaignSectionVisibility(reports.length, filteredReports.length);

  const { effectiveCount, hasMore, loadMore } = useSectionPagination(
    filteredReports.length,
    BROADCAST_ITEMS_PER_ROW,
    3,
    `broadcast:${filteredReports.length}`
  );

  const chronological = shouldRenderChronologically(filter.sortOrder);
  const visibleItems = useMemo(
    () => filteredReports.slice(0, effectiveCount),
    [filteredReports, effectiveCount]
  );
  const visibleGroups = useMemo(() => {
    const ids = new Set(visibleItems.map((report) => report.id));
    return filteredGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((report) => ids.has(report.id)),
      }))
      .filter((group) => group.items.length > 0);
  }, [filteredGroups, visibleItems]);

  if (!sectionVisible) return null;

  return (
    <CollapsibleSection
      id="broadcast-reports"
      title="گزارش پخش صدا و سیما"
      description="گزارش‌های PDF روزانه"
    >
      <SectionTopCompaniesBox groups={filteredGroups} />
      {filteredReports.length === 0 ? (
        <div className="rounded-xl border bg-card py-12 text-center text-muted-foreground">
          گزارشی با فیلتر انتخاب‌شده یافت نشد.
        </div>
      ) : (
        <div className="space-y-4">
          <OwnerGroupedSection
            groups={visibleGroups}
            flatItems={chronological ? visibleItems : null}
          >
            {(groupReports) => (
              <div className={PUBLIC_MEDIA_GRID_CLASS}>
                {groupReports.map((report) => (
                  <BroadcastReportCard key={report.id} report={report} />
                ))}
              </div>
            )}
          </OwnerGroupedSection>

          {hasMore && (
            <ShowMoreButton
              remaining={filteredReports.length - effectiveCount}
              onClick={loadMore}
            />
          )}
        </div>
      )}
    </CollapsibleSection>
  );
}
