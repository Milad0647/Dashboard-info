"use client";

import { useMemo } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
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
import type { CampaignFile, DataOwnerGroup } from "@/lib/types";
import { formatPersianNumber } from "@/lib/utils";

const FILES_ITEMS_PER_ROW = 2;

interface CampaignFilesSectionProps {
  files: CampaignFile[];
  groups: DataOwnerGroup<CampaignFile>[];
}

function FileList({ files }: { files: CampaignFile[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {files.map((file) => {
        const Icon = fileIcon(file.mimeType);
        return (
          <div
            key={file.id}
            className="flex items-start justify-between gap-3 rounded-xl border bg-card p-4"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-muted p-2">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{file.title}</p>
                {file.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{file.description}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {file.fileName} — {formatFileSize(file.fileSize)}
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <a href={file.fileUrl} target="_blank" rel="noopener noreferrer" download={file.fileName}>
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${formatPersianNumber(bytes)} B`;
  if (bytes < 1024 * 1024) return `${formatPersianNumber(Math.round(bytes / 1024))} KB`;
  return `${formatPersianNumber(Math.round(bytes / (1024 * 1024)))} MB`;
}

function fileIcon(mimeType: string) {
  if (mimeType.includes("sheet") || mimeType.includes("excel")) {
    return FileSpreadsheet;
  }
  return FileText;
}

export function CampaignFilesSection({ files, groups }: CampaignFilesSectionProps) {
  const { filter } = useOwnerLocationFilter();
  const filteredGroups = useFilteredOwnerGroups(groups);
  const filteredFiles = useMemo(
    () =>
      filter.sortOrder === "newest" || filter.sortOrder === "oldest" || filter.sortOrder === "top_scored"
        ? flattenOwnerGroupsInSortOrder(filteredGroups, filter.sortOrder)
        : filteredGroups.flatMap((group) => group.items),
    [filteredGroups, filter.sortOrder]
  );
  const sectionVisible = useCampaignSectionVisibility(files.length, filteredFiles.length);

  const { effectiveCount, hasMore, loadMore } = useSectionPagination(
    filteredFiles.length,
    FILES_ITEMS_PER_ROW,
    3,
    `files:${filteredFiles.length}`
  );

  const visibleGroups = useMemo(() => {
    const ids = new Set(filteredFiles.slice(0, effectiveCount).map((file) => file.id));
    return filteredGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((file) => ids.has(file.id)),
      }))
      .filter((group) => group.items.length > 0);
  }, [filteredGroups, filteredFiles, effectiveCount]);

  if (!sectionVisible) return null;

  return (
    <CollapsibleSection
      id="files"
      title="فایل‌های کمپین"
      description="دانلود PDF، Word، Excel و سایر فایل‌های مرتبط با کمپین"
    >
      <SectionTopCompaniesBox groups={filteredGroups} />
      {filteredFiles.length === 0 ? (
        <div className="rounded-xl border bg-card py-12 text-center text-muted-foreground">
          فایلی با فیلتر انتخاب‌شده یافت نشد.
        </div>
      ) : (
        <div className="space-y-4">
          <OwnerGroupedSection groups={visibleGroups}>
            {(groupFiles) => <FileList files={groupFiles} />}
          </OwnerGroupedSection>

          {hasMore && (
            <ShowMoreButton
              remaining={filteredFiles.length - effectiveCount}
              onClick={loadMore}
            />
          )}
        </div>
      )}
    </CollapsibleSection>
  );
}
