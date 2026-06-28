"use client";

import { useState } from "react";
import Image from "next/image";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MeetingDetailDialog } from "@/components/public/meeting-detail-dialog";
import { OwnerGroupedSection } from "@/components/public/owner-grouped-section";
import { SectionHeader } from "@/components/public/section-header";
import type { DataOwnerGroup, MeetingPublicDetail, MeetingPublicPreview } from "@/lib/types";
import { formatPersianDate } from "@/lib/utils";

const MEETINGS_INITIAL_COUNT = 9;
const MEETINGS_PAGE_SIZE = 9;

interface MeetingsSectionProps {
  meetings: MeetingPublicPreview[];
  groups: DataOwnerGroup<MeetingPublicPreview>[];
}

function MeetingPreviewCard({
  meeting,
  onOpen,
}: {
  meeting: MeetingPublicPreview;
  onOpen: () => void;
}) {
  return (
    <Card className="overflow-hidden h-full flex flex-col">
      <div className="relative aspect-[4/3] bg-muted">
        {meeting.imageUrl ? (
          <Image
            src={meeting.imageUrl}
            alt={meeting.title}
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            بدون تصویر
          </div>
        )}
        {meeting.hasPassword && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-background/90 px-2 py-1 text-[11px] border">
            <Lock className="h-3 w-3" />
            محافظت‌شده
          </span>
        )}
      </div>

      <CardContent className="p-4 flex flex-col gap-3 flex-1">
        <div className="space-y-1">
          <h3 className="font-semibold text-sm line-clamp-2">{meeting.title}</h3>
          <p className="text-xs text-muted-foreground">{formatPersianDate(meeting.meetingDate)}</p>
        </div>

        {meeting.summaryPreview && (
          <p className="text-sm text-muted-foreground line-clamp-3 flex-1">{meeting.summaryPreview}</p>
        )}

        <Button variant="outline" size="sm" className="w-full mt-auto" onClick={onOpen}>
          مشاهده جزئیات
        </Button>
      </CardContent>
    </Card>
  );
}

function MeetingsGrid({ meetings }: { meetings: MeetingPublicPreview[] }) {
  const [visibleCount, setVisibleCount] = useState(MEETINGS_INITIAL_COUNT);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingPublicPreview | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailCache, setDetailCache] = useState<Record<string, MeetingPublicDetail>>({});

  const visibleMeetings = meetings.slice(0, visibleCount);
  const hasMore = visibleCount < meetings.length;

  const openMeeting = (meeting: MeetingPublicPreview) => {
    setSelectedMeeting(meeting);
    setDialogOpen(true);
  };

  return (
    <>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleMeetings.map((meeting) => (
            <MeetingPreviewCard key={meeting.id} meeting={meeting} onOpen={() => openMeeting(meeting)} />
          ))}
        </div>

        {hasMore && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={() => setVisibleCount((count) => count + MEETINGS_PAGE_SIZE)}
            >
              مشاهده بیشتر ({meetings.length - visibleCount} باقی‌مانده)
            </Button>
          </div>
        )}
      </div>

      <MeetingDetailDialog
        preview={selectedMeeting}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        cachedDetail={selectedMeeting ? detailCache[selectedMeeting.id] : null}
        onDetailLoaded={(meeting) =>
          setDetailCache((prev) => ({ ...prev, [meeting.id]: meeting }))
        }
      />
    </>
  );
}

export function MeetingsSection({ meetings, groups }: MeetingsSectionProps) {
  if (meetings.length === 0) return null;

  return (
    <section id="meetings">
      <SectionHeader title="جلسات و مصوبات" description="خلاصه جلسات — جزئیات با رمز قابل مشاهده است" />

      <OwnerGroupedSection groups={groups}>
        {(groupMeetings) => <MeetingsGrid meetings={groupMeetings} />}
      </OwnerGroupedSection>
    </section>
  );
}
