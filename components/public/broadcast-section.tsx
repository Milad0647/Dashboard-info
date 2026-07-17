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
import { Download, FileText } from "lucide-react";
import { PublicOwnerTag } from "@/components/public/public-owner-tag";
import { broadcastHasDisplayContent, filterGroupsByDisplayContent } from "@/lib/public-media-section";

const BROADCAST_ITEMS_PER_ROW = 1;

interface BroadcastSectionProps {
  reports: BroadcastReport[];
  groups: DataOwnerGroup<BroadcastReport>[];
}

function BroadcastReportCard({ report }: { report: BroadcastReport }) {
  const { summaryData } = report;

  return (
    <article className="rounded-xl border bg-card p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">{report.title}</h3>
          <PublicOwnerTag ownerUserId={report.ownerUserId} ownerName={report.ownerName} />
        </div>
        <p className="text-sm text-muted-foreground">{formatPersianDate(report.reportDate)}</p>
        {summaryData.notes && (
          <p className="text-sm text-muted-foreground">{summaryData.notes}</p>
        )}
      </div>
      <Button variant="outline" asChild className="shrink-0">
        <a href={report.pdfUrl} target="_blank" rel="noreferrer" download={report.fileName}>
          <Download className="h-4 w-4" />
          دانلود PDF
        </a>
      </Button>
    </article>
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
              <div className="space-y-4">
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
