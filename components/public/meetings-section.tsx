"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { Download, Eye } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PublicContentCard } from "@/components/public/public-content-card";
import { MeetingDetailDialog } from "@/components/public/meeting-detail-dialog";
import { CollapsibleSection } from "@/components/public/collapsible-section";
import { OwnerGroupedSection } from "@/components/public/owner-grouped-section";
import { useFilteredOwnerGroups } from "@/lib/hooks/use-filtered-owner-groups";
import { useCampaignSectionVisibility } from "@/lib/hooks/use-campaign-section-visibility";
import { ShowMoreButton } from "@/components/public/show-more-button";
import { useSectionPagination } from "@/lib/hooks/use-section-pagination";
import { useCampaignContentReveal } from "@/lib/hooks/use-campaign-content-reveal";
import { useCampaignExportMode } from "@/lib/context/campaign-export-context";
import { useOwnerLocationFilter } from "@/lib/context/owner-location-filter-context";
import {
  flattenOwnerGroupsInSortOrder,
  shouldRenderChronologically,
} from "@/lib/owner-groups";
import {
  clearUnlockedMeetings,
} from "@/lib/client/meetings-unlock-storage";
import { toCardThumbnailUrl } from "@/lib/card-image";
import type { DataOwnerGroup, MeetingPublicDetail, MeetingPublicPreview } from "@/lib/types";
import { formatPersianDate } from "@/lib/utils";
import {
  filterGroupsByDisplayContent,
  meetingHasDisplayContent,
  PUBLIC_MEDIA_GRID_CLASS,
} from "@/lib/public-media-section";
import { downloadMedia, getFilenameFromUrl } from "@/lib/media-utils";

const MEETINGS_ITEMS_PER_ROW = 4;

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
  const handleDownload = () => {
    if (!meeting.imageUrl) return;
    void downloadMedia(
      meeting.imageUrl,
      getFilenameFromUrl(meeting.imageUrl, `${meeting.title}.jpg`)
    );
  };

  return (
    <PublicContentCard
      scrollId={meeting.id}
      title={meeting.title}
      date={formatPersianDate(meeting.meetingDate)}
      category="جلسه و مصوبه"
      ownerUserId={meeting.ownerUserId}
      ownerName={meeting.ownerName}
      media={
        meeting.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={toCardThumbnailUrl(meeting.imageUrl)}
            alt={meeting.title}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            بدون تصویر
          </div>
        )
      }
      actions={
        <>
          <Button variant="outline" size="sm" onClick={onOpen} data-export-hide>
            <Eye className="h-4 w-4" />
            مشاهده
          </Button>
          {meeting.imageUrl && (
            <Button variant="outline" size="sm" onClick={handleDownload} data-export-hide>
              <Download className="h-4 w-4" />
              دانلود
            </Button>
          )}
        </>
      }
    />
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
      // Keep details in memory only for this page visit — do not persist to sessionStorage.
      clearUnlockedMeetings(campaignSlug);
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
  const { effectiveCount, hasMore, loadMore, revealContentId } = useSectionPagination(
    meetings.length,
    MEETINGS_ITEMS_PER_ROW,
    3,
    `meetings:${meetings.length}`
  );
  const meetingIds = useMemo(() => meetings.map((meeting) => meeting.id), [meetings]);

  useCampaignContentReveal("meetings", meetingIds, (contentId) =>
    revealContentId(contentId, meetingIds)
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
        <div className={PUBLIC_MEDIA_GRID_CLASS}>
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

    // Do not restore unlocked meeting payloads from browser storage.
    clearUnlockedMeetings(campaignSlug);
    setIsUnlocked(false);
    setDetailCache({});
  }, [campaignSlug, meetingsHasPassword, exportMode]);

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
