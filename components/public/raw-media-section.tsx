"use client";

import { useMemo } from "react";
import { Download, Film, HardDrive, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CollapsibleSection } from "@/components/public/collapsible-section";
import { OwnerGroupedSection } from "@/components/public/owner-grouped-section";
import { SectionTopCompaniesBox } from "@/components/public/section-top-companies-box";
import { useFilteredOwnerGroups } from "@/lib/hooks/use-filtered-owner-groups";
import { useCampaignSectionVisibility } from "@/lib/hooks/use-campaign-section-visibility";
import { flattenOwnerGroupsInSortOrder } from "@/lib/owner-groups";
import { useOwnerLocationFilter } from "@/lib/context/owner-location-filter-context";
import { ShowMoreButton } from "@/components/public/show-more-button";
import { useSectionPagination } from "@/lib/hooks/use-section-pagination";
import { formatStorageBytes } from "@/lib/raw-media-storage";
import type { DataOwnerGroup, RawMediaStorageSummary, RawMediaUpload } from "@/lib/types";
import { formatPersianDateTime, formatPersianNumber } from "@/lib/utils";

const RAW_MEDIA_ITEMS_PER_ROW = 2;

interface RawMediaSectionProps {
  items: RawMediaUpload[];
  groups: DataOwnerGroup<RawMediaUpload>[];
  storage: RawMediaStorageSummary;
}

function RawMediaList({ items }: { items: RawMediaUpload[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map((item) => {
        const Icon = item.mediaKind === "video" ? Film : ImageIcon;
        return (
          <div
            key={item.id}
            className="flex items-start justify-between gap-3 rounded-xl border bg-card p-4"
          >
            <div className="flex min-w-0 items-start gap-3">
              <div className="rounded-lg bg-muted p-2">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-medium">{item.title}</p>
                {item.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.fileName} — {formatStorageBytes(item.fileSize)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatPersianDateTime(item.createdAt)}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild className="shrink-0">
              <a href={item.fileUrl} target="_blank" rel="noopener noreferrer" download={item.fileName}>
                <Download className="h-4 w-4" />
                دانلود
              </a>
            </Button>
          </div>
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
        فضای ذخیره‌سازی ارسال رویش
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

export function RawMediaSection({ items, groups, storage }: RawMediaSectionProps) {
  const { filter } = useOwnerLocationFilter();
  const filteredGroups = useFilteredOwnerGroups(groups);
  const filteredItems = useMemo(
    () =>
      filter.sortOrder === "newest" || filter.sortOrder === "oldest" || filter.sortOrder === "top_scored"
        ? flattenOwnerGroupsInSortOrder(filteredGroups, filter.sortOrder)
        : filteredGroups.flatMap((group) => group.items),
    [filteredGroups, filter.sortOrder]
  );
  const sectionVisible = useCampaignSectionVisibility(items.length, filteredItems.length);

  const { effectiveCount, hasMore, loadMore } = useSectionPagination(
    filteredItems.length,
    RAW_MEDIA_ITEMS_PER_ROW,
    3,
    `raw-media:${filteredItems.length}`
  );

  const visibleGroups = useMemo(() => {
    const ids = new Set(filteredItems.slice(0, effectiveCount).map((item) => item.id));
    return filteredGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => ids.has(item.id)),
      }))
      .filter((group) => group.items.length > 0);
  }, [filteredGroups, filteredItems, effectiveCount]);

  if (!sectionVisible) return null;

  return (
    <CollapsibleSection
      id="raw-media"
      title="ارسال رویش"
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
          <OwnerGroupedSection groups={visibleGroups}>
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
