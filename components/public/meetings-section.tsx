"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { MeetingDetailDialog } from "@/components/public/meeting-detail-dialog";
import { CollapsibleSection } from "@/components/public/collapsible-section";
import { OwnerGroupedSection } from "@/components/public/owner-grouped-section";
import { useFilteredOwnerGroups } from "@/lib/hooks/use-filtered-owner-groups";
import { useCampaignSectionVisibility } from "@/lib/hooks/use-campaign-section-visibility";
import { ShowMoreButton } from "@/components/public/show-more-button";
import { useSectionPagination } from "@/lib/hooks/use-section-pagination";
import { useCampaignExportMode } from "@/lib/context/campaign-export-context";
import { useOwnerLocationFilter } from "@/lib/context/owner-location-filter-context";
import {
  flattenOwnerGroupsInSortOrder,
  shouldRenderChronologically,
} from "@/lib/owner-groups";
import {
  loadUnlockedMeetings,
  saveUnlockedMeetings,
} from "@/lib/client/meetings-unlock-storage";
import type { DataOwnerGroup, MeetingPublicDetail, MeetingPublicPreview } from "@/lib/types";
import { formatPersianDate } from "@/lib/utils";
import { PublicOwnerTag } from "@/components/public/public-owner-tag";
import { filterGroupsByDisplayContent, meetingHasDisplayContent } from "@/lib/public-media-section";

const MEETINGS_ITEMS_PER_ROW = 4;
const MEETINGS_GRID_CLASS = "grid grid-cols-2 md:grid-cols-4 gap-4";

interface MeetingsSectionProps {
  campaignSlug: string;
  meetingsHasPassword: boolean;
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
      </div>

      <CardContent className="p-4 flex flex-col gap-3 flex-1">
        <div className="space-y-1">
          <div className="flex flex-wrap items-start gap-1.5">
            <h3 className="font-semibold text-sm line-clamp-2">{meeting.title}</h3>
            <PublicOwnerTag ownerUserId={meeting.ownerUserId} ownerName={meeting.ownerName} />
          </div>
          <p className="text-xs text-muted-foreground">{formatPersianDate(meeting.meetingDate)}</p>
        </div>

        {meeting.summaryPreview && (
          <p className="text-sm text-muted-foreground line-clamp-3 flex-1">{meeting.summaryPreview}</p>
        )}

        <Button variant="outline" size="sm" className="w-full mt-auto" onClick={onOpen} data-export-hide>
          مشاهده جزئیات
        </Button>
      </CardContent>
    </Card>
  );
}

function MeetingsUnlockBanner({
  campaignSlug,
  onUnlocked,
}: {
  campaignSlug: string;
  onUnlocked: (details: Record<string, MeetingPublicDetail>) => void;
}) {
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleUnlock = () => {
    startTransition(async () => {
      const response = await fetch(`/api/campaign/${encodeURIComponent(campaignSlug)}/meetings/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (response.status === 401) {
        toast.error("رمز اشتباه است");
        return;
      }

      if (!response.ok) {
        toast.error("دسترسی به جلسات ممکن نشد");
        return;
      }

      const data = (await response.json()) as { meetings: MeetingPublicDetail[] };
      saveUnlockedMeetings(campaignSlug, data.meetings);
      onUnlocked(Object.fromEntries(data.meetings.map((meeting) => [meeting.id, meeting])));
      toast.success("همه جلسات باز شدند");
    });
  };

  return (
    <div className="flex flex-col sm:flex-row gap-2 max-w-md">
      <div className="flex-1 space-y-1">
        <Label htmlFor="meetings-section-password" className="sr-only">
          دسترسی جلسات
        </Label>
        <Input
          id="meetings-section-password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleUnlock();
          }}
        />
      </div>
      <Button onClick={handleUnlock} disabled={isPending || !password.trim()} className="shrink-0">
        باز کردن
      </Button>
    </div>
  );
}

function MeetingsGrid({
  meetings,
  meetingsHasPassword,
  isUnlocked,
  detailCache,
}: {
  meetings: MeetingPublicPreview[];
  meetingsHasPassword: boolean;
  isUnlocked: boolean;
  detailCache: Record<string, MeetingPublicDetail>;
}) {
  const { effectiveCount, hasMore, loadMore } = useSectionPagination(
    meetings.length,
    MEETINGS_ITEMS_PER_ROW,
    3,
    `meetings:${meetings.length}`
  );
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingPublicPreview | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const visibleMeetings = meetings.slice(0, effectiveCount);

  const openMeeting = (meeting: MeetingPublicPreview) => {
    setSelectedMeeting(meeting);
    setDialogOpen(true);
  };

  return (
    <>
      <div className="space-y-4">
        <div className={MEETINGS_GRID_CLASS}>
          {visibleMeetings.map((meeting) => (
            <MeetingPreviewCard
              key={meeting.id}
              meeting={meeting}
              onOpen={() => openMeeting(meeting)}
            />
          ))}
        </div>

        {hasMore && (
          <ShowMoreButton
            remaining={meetings.length - effectiveCount}
            onClick={loadMore}
          />
        )}
      </div>

      <MeetingDetailDialog
        preview={selectedMeeting}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        cachedDetail={selectedMeeting ? detailCache[selectedMeeting.id] : null}
        meetingsHasPassword={meetingsHasPassword}
        isUnlocked={isUnlocked}
      />
    </>
  );
}

export function MeetingsSection({
  campaignSlug,
  meetingsHasPassword,
  meetings,
  groups,
}: MeetingsSectionProps) {
  const exportMode = useCampaignExportMode();
  const { filter } = useOwnerLocationFilter();
  const locationFilteredGroups = useFilteredOwnerGroups(groups, (meeting) => meeting.meetingDate);
  const filteredGroups = useMemo(
    () => filterGroupsByDisplayContent(locationFilteredGroups, meetingHasDisplayContent),
    [locationFilteredGroups]
  );
  const filteredMeetings = useMemo(
    () => flattenOwnerGroupsInSortOrder(filteredGroups, filter.sortOrder),
    [filteredGroups, filter.sortOrder]
  );
  const chronological = shouldRenderChronologically(filter.sortOrder);
  const sectionVisible = useCampaignSectionVisibility(meetings.length, filteredMeetings.length);
  const [detailCache, setDetailCache] = useState<Record<string, MeetingPublicDetail>>({});
  const [isUnlocked, setIsUnlocked] = useState(!meetingsHasPassword);

  const applyUnlock = useCallback((details: Record<string, MeetingPublicDetail>) => {
    setDetailCache(details);
    setIsUnlocked(true);
  }, []);

  useEffect(() => {
    if (!meetingsHasPassword || exportMode) {
      setIsUnlocked(true);
      return;
    }

    const cached = loadUnlockedMeetings(campaignSlug);
    if (cached) {
      applyUnlock(cached);
    }
  }, [campaignSlug, meetingsHasPassword, exportMode, applyUnlock]);

  if (!sectionVisible) return null;

  const sectionLocked = meetingsHasPassword && !isUnlocked;

  return (
    <CollapsibleSection
      id="meetings"
      title="جلسات و مصوبات"
      description={sectionLocked ? undefined : "آخرین جلسات و مصوبات"}
    >
      {sectionLocked ? (
        <MeetingsUnlockBanner campaignSlug={campaignSlug} onUnlocked={applyUnlock} />
      ) : (
        <OwnerGroupedSection
          groups={filteredGroups}
          flatItems={chronological ? filteredMeetings : null}
        >
          {(groupMeetings) => (
            <MeetingsGrid
              meetings={groupMeetings}
              meetingsHasPassword={meetingsHasPassword}
              isUnlocked={isUnlocked}
              detailCache={detailCache}
            />
          )}
        </OwnerGroupedSection>
      )}
    </CollapsibleSection>
  );
}
