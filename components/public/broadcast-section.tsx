"use client";

import { useMemo, useState } from "react";
import type { BroadcastReport, DataOwnerGroup, VideoVersion } from "@/lib/types";
import { formatPersianDate } from "@/lib/utils";
import { CollapsibleSection } from "@/components/public/collapsible-section";
import { OwnerGroupedSection } from "@/components/public/owner-grouped-section";
import { SectionTopCompaniesBox } from "@/components/public/section-top-companies-box";
import { useFilteredOwnerGroups } from "@/lib/hooks/use-filtered-owner-groups";
import { useCampaignSectionVisibility } from "@/lib/hooks/use-campaign-section-visibility";
import { useSectionPagination } from "@/lib/hooks/use-section-pagination";
import { useCampaignContentReveal } from "@/lib/hooks/use-campaign-content-reveal";
import { flattenOwnerGroupsInSortOrder, shouldRenderChronologically } from "@/lib/owner-groups";
import { useOwnerLocationFilter } from "@/lib/context/owner-location-filter-context";
import { ShowMoreButton } from "@/components/public/show-more-button";
import { Button } from "@/components/ui/button";
import { Download, Eye, FileText, Play } from "lucide-react";
import { PublicContentCard } from "@/components/public/public-content-card";
import {
  broadcastHasDisplayContent,
  filterGroupsByDisplayContent,
  PUBLIC_MEDIA_GRID_CLASS,
} from "@/lib/public-media-section";
import { ContentScoreControl } from "@/components/admin/content-score-control";
import { useContentScoreAccess } from "@/lib/context/content-score-context";
import { resolveBroadcastMediaType } from "@/lib/broadcast-media";
import { downloadMedia, getFilenameFromUrl } from "@/lib/media-utils";
import { VideoModal } from "@/components/media/video-modal";
import { VideoThumbnail } from "@/components/media/video-thumbnail";

const BROADCAST_ITEMS_PER_ROW = 1;

interface BroadcastSectionProps {
  reports: BroadcastReport[];
  groups: DataOwnerGroup<BroadcastReport>[];
}

function toBroadcastVideoVersion(report: BroadcastReport): VideoVersion {
  const cover = report.summaryData.coverImageUrl?.trim();
  return {
    id: report.id,
    videoId: report.id,
    versionNumber: 1,
    videoUrl: report.pdfUrl,
    thumbnailUrl: cover || report.pdfUrl,
    status: "final",
    isFinal: true,
    date: report.reportDate,
    createdAt: report.createdAt,
  };
}

function BroadcastReportCard({ report }: { report: BroadcastReport }) {
  const { canScore, campaignId } = useContentScoreAccess();
  const [videoOpen, setVideoOpen] = useState(false);
  const mediaType = resolveBroadcastMediaType(report);
  const isVideo = mediaType === "video";
  const videoVersion = isVideo ? toBroadcastVideoVersion(report) : null;

  const handleDownload = () => {
    void downloadMedia(
      report.pdfUrl,
      report.fileName || getFilenameFromUrl(report.pdfUrl, isVideo ? `${report.title}.mp4` : `${report.title}.pdf`)
    );
  };

  return (
    <>
      <PublicContentCard
        scrollId={report.id}
        onClick={isVideo ? () => setVideoOpen(true) : undefined}
        title={report.title}
        date={formatPersianDate(report.reportDate)}
        category={isVideo ? "ویدیو پخش" : "گزارش PDF"}
        topics={report.planLabels ?? (report.planLabel ? [report.planLabel] : [])}
        ownerUserId={report.ownerUserId}
        ownerName={report.ownerName}
        media={
          isVideo ? (
            <div className="group relative h-full w-full cursor-pointer">
              <VideoThumbnail
                videoUrl={report.pdfUrl}
                thumbnailUrl={report.summaryData.coverImageUrl}
                alt={report.title}
                className="apple-media-zoom object-cover"
              />
              <div className="apple-overlay pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/35">
                <Play className="h-12 w-12 text-white drop-shadow-lg transition-transform duration-[var(--duration-apple)] ease-[var(--ease-apple-spring)] group-hover:scale-110" />
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 bg-muted">
              <FileText className="h-16 w-16 text-primary" />
              <span className="text-xs text-muted-foreground">PDF</span>
            </div>
          )
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
            {isVideo ? (
              <Button variant="outline" size="sm" onClick={() => setVideoOpen(true)}>
                <Eye className="h-4 w-4" />
                مشاهده
              </Button>
            ) : (
              <Button variant="outline" size="sm" asChild>
                <a href={report.pdfUrl} target="_blank" rel="noreferrer">
                  <Eye className="h-4 w-4" />
                  مشاهده
                </a>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4" />
              دانلود
            </Button>
          </>
        }
      />

      {videoVersion && (
        <VideoModal
          open={videoOpen}
          onOpenChange={setVideoOpen}
          title={report.title}
          versions={[videoVersion]}
          initialVersionId={videoVersion.id}
          description={report.summaryData.notes}
          category="ویدیو پخش"
          topics={report.planLabels ?? (report.planLabel ? [report.planLabel] : [])}
          ownerName={report.ownerName}
        />
      )}
    </>
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

  const { effectiveCount, hasMore, loadMore, revealContentId } = useSectionPagination(
    filteredReports.length,
    BROADCAST_ITEMS_PER_ROW,
    3,
    `broadcast:${filteredReports.length}`
  );

  const reportIds = useMemo(() => filteredReports.map((report) => report.id), [filteredReports]);

  useCampaignContentReveal("broadcast-reports", reportIds, (contentId) =>
    revealContentId(contentId, reportIds)
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
      description="گزارش‌های PDF و ویدیوی روزانه"
    >
      <SectionTopCompaniesBox groups={filteredGroups} contentKind="broadcast" />
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
