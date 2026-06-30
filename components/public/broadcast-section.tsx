"use client";

import { useMemo } from "react";
import type { BroadcastReport, DataOwnerGroup } from "@/lib/types";
import { formatPersianDate } from "@/lib/utils";
import { CollapsibleSection } from "@/components/public/collapsible-section";
import { OwnerGroupedSection } from "@/components/public/owner-grouped-section";
import { useFilteredOwnerGroups } from "@/lib/hooks/use-filtered-owner-groups";
import { ShowMoreButton } from "@/components/public/show-more-button";
import { useSectionPagination } from "@/lib/hooks/use-section-pagination";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";

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
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">{report.title}</h3>
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
  const filteredGroups = useFilteredOwnerGroups(groups);
  const filteredReports = useMemo(
    () => filteredGroups.flatMap((group) => group.items),
    [filteredGroups]
  );

  const { effectiveCount, hasMore, loadMore } = useSectionPagination(
    filteredReports.length,
    BROADCAST_ITEMS_PER_ROW,
    3,
    `broadcast:${filteredReports.length}`
  );

  const visibleGroups = useMemo(() => {
    const ids = new Set(filteredReports.slice(0, effectiveCount).map((report) => report.id));
    return filteredGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((report) => ids.has(report.id)),
      }))
      .filter((group) => group.items.length > 0);
  }, [filteredGroups, filteredReports, effectiveCount]);

  if (reports.length === 0) return null;

  return (
    <CollapsibleSection
      id="broadcast-reports"
      title="گزارش پخش صدا و سیما"
      description="گزارش‌های PDF روزانه"
    >
      {filteredReports.length === 0 ? (
        <div className="rounded-xl border bg-card py-12 text-center text-muted-foreground">
          گزارشی با فیلتر انتخاب‌شده یافت نشد.
        </div>
      ) : (
        <div className="space-y-4">
          <OwnerGroupedSection groups={visibleGroups}>
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
