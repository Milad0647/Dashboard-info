"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { KPICard } from "@/components/public/kpi-card";
import { CollapsibleSection } from "@/components/public/collapsible-section";
import { OwnerGroupedSection } from "@/components/public/owner-grouped-section";
import { ParticipationChart } from "@/components/charts/participation-chart";
import { useCampaignExportMode } from "@/lib/context/campaign-export-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { hasUserOwnedGroups } from "@/lib/owner-groups";
import type { CampaignSubmission, DataOwnerGroup, SubmissionSummary } from "@/lib/types";
import { formatPersianDate, formatPersianNumber, getStatusLabel } from "@/lib/utils";
import { CheckCircle, Clock, FileText, Users, XCircle } from "lucide-react";

const SUBMISSIONS_INITIAL_COUNT = 12;
const SUBMISSIONS_PAGE_SIZE = 12;

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

export function SubmissionsSection({ submissions, groups, summary }: SubmissionsSectionProps) {
  const exportMode = useCampaignExportMode();
  const [visibleCount, setVisibleCount] = useState(SUBMISSIONS_INITIAL_COUNT);
  const enablePagination = !hasUserOwnedGroups(groups);
  const effectiveCount = exportMode || !enablePagination ? submissions.length : visibleCount;
  const visibleGroups = useMemo(() => {
    const ids = new Set(submissions.slice(0, effectiveCount).map((submission) => submission.id));
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((submission) => ids.has(submission.id)),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, submissions, effectiveCount]);
  const hasMore = enablePagination && !exportMode && visibleCount < submissions.length;

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

      {submissions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-xl bg-card">
          ارسال تأییدشده‌ای وجود ندارد.
        </div>
      ) : (
        <div className="space-y-4">
          <OwnerGroupedSection groups={visibleGroups}>
            {(groupSubmissions) => <SubmissionCards submissions={groupSubmissions} />}
          </OwnerGroupedSection>

          {hasMore && (
            <div className="flex justify-center" data-export-hide>
              <Button
                variant="outline"
                onClick={() => setVisibleCount((count) => count + SUBMISSIONS_PAGE_SIZE)}
              >
                نمایش بیشتر ({formatPersianNumber(submissions.length - visibleCount)} باقی‌مانده)
              </Button>
            </div>
          )}
        </div>
      )}
    </CollapsibleSection>
  );
}
