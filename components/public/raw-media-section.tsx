"use client";

import { useMemo, useState } from "react";
import { Download, Eye, FileArchive, HardDrive, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CollapsibleSection } from "@/components/public/collapsible-section";
import { OwnerGroupedSection } from "@/components/public/owner-grouped-section";
import { SectionTopCompaniesBox } from "@/components/public/section-top-companies-box";
import { useFilteredOwnerGroups } from "@/lib/hooks/use-filtered-owner-groups";
import { useCampaignSectionVisibility } from "@/lib/hooks/use-campaign-section-visibility";
import { flattenOwnerGroupsInSortOrder, shouldRenderChronologically } from "@/lib/owner-groups";
import { useOwnerLocationFilter } from "@/lib/context/owner-location-filter-context";
import { ShowMoreButton } from "@/components/public/show-more-button";
import { useSectionPagination } from "@/lib/hooks/use-section-pagination";
import { formatStorageBytes } from "@/lib/raw-media-storage";
import { PublicContentCard } from "@/components/public/public-content-card";
import {
  fileHasDisplayContent,
  filterGroupsByDisplayContent,
  PUBLIC_MEDIA_GRID_CLASS,
} from "@/lib/public-media-section";
import { ContentScoreControl } from "@/components/admin/content-score-control";
import { useContentScoreAccess } from "@/lib/context/content-score-context";
import { VideoThumbnail } from "@/components/media/video-thumbnail";
import { ImageZoom } from "@/components/ui/image-zoom";
import type { DataOwnerGroup, RawMediaStorageSummary, RawMediaUpload } from "@/lib/types";
import { formatPersianDateTime, formatPersianNumber } from "@/lib/utils";

const RAW_MEDIA_ITEMS_PER_ROW = 2;

interface RawMediaSectionProps {
  items: RawMediaUpload[];
  groups: DataOwnerGroup<RawMediaUpload>[];
  storage: RawMediaStorageSummary;
  campaignId?: string;
}

function RawMediaList({ items }: { items: RawMediaUpload[] }) {
  const { canScore, campaignId } = useContentScoreAccess();

  return (
    <div className={PUBLIC_MEDIA_GRID_CLASS}>
      {items.map((item) => {
        return (
          <PublicContentCard
            key={item.id}
            title={item.title}
            date={formatPersianDateTime(item.createdAt)}
            category={item.mediaKind === "video" ? "ویدیو خام" : "تصویر خام"}
            topics={item.planLabels ?? (item.planLabel ? [item.planLabel] : [])}
            ownerUserId={item.ownerUserId}
            ownerName={item.ownerName}
            media={
              item.mediaKind === "video" ? (
                <VideoThumbnail
                  videoUrl={item.fileUrl}
                  alt={item.title}
                  className="object-cover"
                />
              ) : (
                <ImageZoom
                  src={item.fileUrl}
                  alt={item.title}
                  className="h-full w-full"
                  imgClassName="object-cover"
                  sizes="(max-width: 640px) 100vw, 280px"
                />
              )
            }
            score={
              canScore || item.score != null ? (
                <ContentScoreControl
                  campaignId={campaignId || item.campaignId}
                  contentType="raw_media"
                  contentId={item.id}
                  score={item.score}
                  canScore={canScore}
                  compact
                />
              ) : null
            }
            actions={
              <>
                <Button variant="outline" size="sm" asChild>
                  <a href={item.fileUrl} target="_blank" rel="noopener noreferrer">
                    <Eye className="h-4 w-4" />
                    مشاهده
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={item.fileUrl} download={item.fileName}>
                    <Download className="h-4 w-4" />
                    دانلود
                  </a>
                </Button>
              </>
            }
          />
        );
      })}
    </div>
  );
}

function StorageMeter({ storage }: { storage: RawMediaStorageSummary }) {
  return (
    <div className="mb-4 rounded-xl border bg-card p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        <HardDrive className="h-4 w-4 text-primary" />
        فضای ذخیره‌سازی راش تصویر
      </div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {formatStorageBytes(storage.usedBytes)} از {formatStorageBytes(storage.limitBytes)}
        </span>
        <span className="font-semibold">{formatPersianNumber(storage.percentUsed)}٪</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${
            storage.percentUsed >= 90
              ? "bg-destructive"
              : storage.percentUsed >= 70
                ? "bg-amber-500"
                : "bg-primary"
          }`}
          style={{ width: `${storage.percentUsed}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {formatPersianNumber(storage.fileCount)} فایل — باقی‌مانده:{" "}
        {formatStorageBytes(storage.remainingBytes)}
      </p>
    </div>
  );
}

export function RawMediaSection({ items, groups, storage, campaignId }: RawMediaSectionProps) {
  const { filter } = useOwnerLocationFilter();
  const [isExporting, setIsExporting] = useState(false);
  const locationFilteredGroups = useFilteredOwnerGroups(groups);
  const filteredGroups = useMemo(
    () => filterGroupsByDisplayContent(locationFilteredGroups, fileHasDisplayContent),
    [locationFilteredGroups]
  );
  const filteredItems = useMemo(
    () => flattenOwnerGroupsInSortOrder(filteredGroups, filter.sortOrder),
    [filteredGroups, filter.sortOrder]
  );
  const sectionVisible = useCampaignSectionVisibility(items.length, filteredItems.length);
  const resolvedCampaignId = campaignId ?? items[0]?.campaignId;

  const { effectiveCount, hasMore, loadMore } = useSectionPagination(
    filteredItems.length,
    RAW_MEDIA_ITEMS_PER_ROW,
    3,
    `raw-media:${filteredItems.length}`
  );

  const chronological = shouldRenderChronologically(filter.sortOrder);
  const visibleItems = useMemo(
    () => filteredItems.slice(0, effectiveCount),
    [filteredItems, effectiveCount]
  );
  const visibleGroups = useMemo(() => {
    const ids = new Set(visibleItems.map((item) => item.id));
    return filteredGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => ids.has(item.id)),
      }))
      .filter((group) => group.items.length > 0);
  }, [filteredGroups, visibleItems]);

  const handleDownloadAll = async () => {
    if (!resolvedCampaignId || isExporting) return;
    setIsExporting(true);
    try {
      const response = await fetch(
        `/api/campaign/raw-media/export?campaignId=${encodeURIComponent(resolvedCampaignId)}`
      );
      if (response.status === 401) {
        toast.error("برای دانلود گروهی وارد پنل مدیریت شوید");
        return;
      }
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        toast.error(result?.error ?? "خطا در ساخت فایل ZIP");
        return;
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `raw-media-${resolvedCampaignId}.zip`;
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(blobUrl);
      toast.success("دانلود ZIP شروع شد");
    } catch {
      toast.error("خطا در دانلود ZIP");
    } finally {
      setIsExporting(false);
    }
  };

  if (!sectionVisible) return null;

  return (
    <CollapsibleSection
      id="raw-media"
      title="راش تصویر"
      description="عکس و فیلم خام با حجم بالا — قابل دانلود توسط مدیر و کارفرما"
    >
      <SectionTopCompaniesBox groups={filteredGroups} />
      <StorageMeter storage={storage} />
      {filteredItems.length === 0 ? (
        <div className="rounded-xl border bg-card py-12 text-center text-muted-foreground">
          رسانه‌ای با فیلتر انتخاب‌شده یافت نشد.
        </div>
      ) : (
        <div className="space-y-4">
          {resolvedCampaignId && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                disabled={isExporting}
                onClick={() => void handleDownloadAll()}
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileArchive className="h-4 w-4" />
                )}
                {isExporting ? "در حال آماده‌سازی…" : "دانلود همه (ZIP)"}
              </Button>
            </div>
          )}

          <OwnerGroupedSection
            groups={visibleGroups}
            flatItems={chronological ? visibleItems : null}
          >
            {(groupItems) => <RawMediaList items={groupItems} />}
          </OwnerGroupedSection>

          {hasMore && (
            <ShowMoreButton
              remaining={filteredItems.length - effectiveCount}
              onClick={loadMore}
            />
          )}
        </div>
      )}
    </CollapsibleSection>
  );
}
