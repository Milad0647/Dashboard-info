"use client";

import { useMemo } from "react";
import Image from "next/image";
import { KPICard } from "@/components/public/kpi-card";
import { CollapsibleSection } from "@/components/public/collapsible-section";
import { OwnerGroupedSection } from "@/components/public/owner-grouped-section";
import { ParticipationChart } from "@/components/charts/participation-chart";
import { useFilteredOwnerGroups } from "@/lib/hooks/use-filtered-owner-groups";
import { ShowMoreButton } from "@/components/public/show-more-button";
import { useSectionPagination } from "@/lib/hooks/use-section-pagination";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { CampaignSubmission, DataOwnerGroup, SubmissionSummary } from "@/lib/types";
import { formatPersianDate, getStatusLabel } from "@/lib/utils";
import { CheckCircle, Clock, FileText, Users, XCircle } from "lucide-react";

const SUBMISSIONS_ITEMS_PER_ROW = 4;

interface SubmissionsSectionProps {
  submissions: CampaignSubmission[];
  groups: DataOwnerGroup<CampaignSubmission>[];
  summary: SubmissionSummary;
}

function SubmissionCards({ submissions }: { submissions: CampaignSubmission[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {submissions.map((sub) => (
        <Card key={sub.id} className="overflow-hidden">
          {sub.mediaUrl && (
            <div className="relative aspect-video bg-muted">
              <Image
                src={sub.mediaUrl}
                alt={sub.title}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 50vw, 25vw"
              />
            </div>
          )}
          <CardContent className="p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-sm line-clamp-2">{sub.title}</h3>
              <Badge status={sub.status}>{getStatusLabel(sub.status)}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{sub.submissionType}</p>
            <p className="text-sm line-clamp-2">{sub.text}</p>
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
              <span className="truncate">
                {sub.participantName === "ناشناس" ? "کاربر ناشناس" : sub.participantName}
              </span>
              <span className="shrink-0">{formatPersianDate(sub.createdAt)}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function SubmissionsSection({ groups, summary }: SubmissionsSectionProps) {
  const filteredGroups = useFilteredOwnerGroups(groups);
  const filteredSubmissions = useMemo(
    () => filteredGroups.flatMap((group) => group.items),
    [filteredGroups]
  );

  const { effectiveCount, hasMore, loadMore } = useSectionPagination(
    filteredSubmissions.length,
    SUBMISSIONS_ITEMS_PER_ROW,
    3,
    `submissions:${filteredSubmissions.length}`
  );

  const visibleGroups = useMemo(() => {
    const ids = new Set(filteredSubmissions.slice(0, effectiveCount).map((submission) => submission.id));
    return filteredGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((submission) => ids.has(submission.id)),
      }))
      .filter((group) => group.items.length > 0);
  }, [filteredGroups, filteredSubmissions, effectiveCount]);

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
          <OwnerGroupedSection groups={visibleGroups}>
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
