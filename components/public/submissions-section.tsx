"use client";

import { useMemo } from "react";
import { KPICard } from "@/components/public/kpi-card";
import { CollapsibleSection } from "@/components/public/collapsible-section";
import { OwnerGroupedSection } from "@/components/public/owner-grouped-section";
import { ParticipationChart } from "@/components/charts/participation-chart";
import { useFilteredOwnerGroups } from "@/lib/hooks/use-filtered-owner-groups";
import { flattenOwnerGroupsInSortOrder, shouldRenderChronologically } from "@/lib/owner-groups";
import { useOwnerLocationFilter } from "@/lib/context/owner-location-filter-context";
import { ShowMoreButton } from "@/components/public/show-more-button";
import { useSectionPagination } from "@/lib/hooks/use-section-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PublicContentCard } from "@/components/public/public-content-card";
import { VideoThumbnail } from "@/components/media/video-thumbnail";
import { ImageZoom } from "@/components/ui/image-zoom";
import { PUBLIC_MEDIA_GRID_CLASS } from "@/lib/public-media-section";
import { isDirectVideoUrl } from "@/lib/media-utils";
import type { CampaignSubmission, DataOwnerGroup, SubmissionSummary } from "@/lib/types";
import { formatPersianDate, getStatusLabel } from "@/lib/utils";
import { CheckCircle, Clock, Download, Eye, FileText, Users, XCircle } from "lucide-react";

const SUBMISSIONS_ITEMS_PER_ROW = 4;

interface SubmissionsSectionProps {
  submissions: CampaignSubmission[];
  groups: DataOwnerGroup<CampaignSubmission>[];
  summary: SubmissionSummary;
}

function SubmissionMedia({ submission }: { submission: CampaignSubmission }) {
  const mediaUrl = submission.mediaUrl?.trim();
  if (!mediaUrl) {
    return (
      <div className="flex h-full items-center justify-center bg-muted">
        <Badge status={submission.status}>{getStatusLabel(submission.status)}</Badge>
      </div>
    );
  }

  const isVideo =
    submission.submissionType === "ویدیو" ||
    submission.submissionType.toLowerCase() === "video" ||
    isDirectVideoUrl(mediaUrl);

  if (isVideo) {
    return (
      <VideoThumbnail
        videoUrl={mediaUrl}
        alt={submission.title}
        className="object-cover"
      />
    );
  }

  return (
    <ImageZoom
      src={mediaUrl}
      alt={submission.title}
      className="absolute inset-0 h-full w-full"
      imgClassName="object-cover"
      sizes="(max-width: 1024px) 50vw, 25vw"
    />
  );
}

function SubmissionCards({ submissions }: { submissions: CampaignSubmission[] }) {
  return (
    <div className={PUBLIC_MEDIA_GRID_CLASS}>
      {submissions.map((sub) => (
        <PublicContentCard
          key={sub.id}
          title={sub.title}
          date={formatPersianDate(sub.createdAt)}
          category={`${sub.submissionType} — ${getStatusLabel(sub.status)}`}
          topics={sub.planLabels ?? (sub.planLabel ? [sub.planLabel] : [])}
          ownerUserId={sub.ownerUserId}
          ownerName={sub.ownerName}
          media={<SubmissionMedia submission={sub} />}
          actions={
            sub.mediaUrl ? (
              <>
                <Button variant="outline" size="sm" asChild>
                  <a href={sub.mediaUrl} target="_blank" rel="noreferrer">
                    <Eye className="h-4 w-4" />
                    مشاهده
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={sub.mediaUrl} download>
                    <Download className="h-4 w-4" />
                    دانلود
                  </a>
                </Button>
              </>
            ) : undefined
          }
        />
      ))}
    </div>
  );
}

export function SubmissionsSection({ groups, summary }: SubmissionsSectionProps) {
  const { filter } = useOwnerLocationFilter();
  const filteredGroups = useFilteredOwnerGroups(groups);
  const filteredSubmissions = useMemo(
    () => flattenOwnerGroupsInSortOrder(filteredGroups, filter.sortOrder),
    [filteredGroups, filter.sortOrder]
  );

  const { effectiveCount, hasMore, loadMore } = useSectionPagination(
    filteredSubmissions.length,
    SUBMISSIONS_ITEMS_PER_ROW,
    3,
    `submissions:${filteredSubmissions.length}`
  );

  const chronological = shouldRenderChronologically(filter.sortOrder);
  const visibleItems = useMemo(
    () => filteredSubmissions.slice(0, effectiveCount),
    [filteredSubmissions, effectiveCount]
  );
  const visibleGroups = useMemo(() => {
    const ids = new Set(visibleItems.map((submission) => submission.id));
    return filteredGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((submission) => ids.has(submission.id)),
      }))
      .filter((group) => group.items.length > 0);
  }, [filteredGroups, visibleItems]);

  return (
    <CollapsibleSection
      id="submissions"
      title="مشارکت کاربران"
      description="مشارکت‌کنندگان و ارسال‌های تأییدشده در کمپین"
    >

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <KPICard title="شرکت‌کنندگان" value={summary.totalParticipants} icon={Users} />
        <KPICard title="کل ارسال‌ها" value={summary.totalSubmissions} icon={FileText} />
        <KPICard title="تأیید شده" value={summary.approvedSubmissions} icon={CheckCircle} />
        <KPICard title="در انتظار" value={summary.pendingSubmissions} icon={Clock} />
        <KPICard title="رد شده" value={summary.rejectedSubmissions} icon={XCircle} />
      </div>

      <div className="mb-6">
        <ParticipationChart data={summary.participationByDate} />
      </div>

      {filteredSubmissions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-xl bg-card">
          ارسال تأییدشده‌ای با فیلتر انتخاب‌شده وجود ندارد.
        </div>
      ) : (
        <div className="space-y-4">
          <OwnerGroupedSection
            groups={visibleGroups}
            flatItems={chronological ? visibleItems : null}
          >
            {(groupSubmissions) => <SubmissionCards submissions={groupSubmissions} />}
          </OwnerGroupedSection>

          {hasMore && (
            <ShowMoreButton
              remaining={filteredSubmissions.length - effectiveCount}
              onClick={loadMore}
              label="نمایش بیشتر"
            />
          )}
        </div>
      )}
    </CollapsibleSection>
  );
}
