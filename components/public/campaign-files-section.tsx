"use client";

import { useMemo } from "react";
import { Download, Eye, FileSpreadsheet, FileText } from "lucide-react";
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
import { useCampaignContentReveal } from "@/lib/hooks/use-campaign-content-reveal";
import { PublicContentCard } from "@/components/public/public-content-card";
import {
  fileHasDisplayContent,
  filterGroupsByDisplayContent,
  PUBLIC_MEDIA_GRID_CLASS,
} from "@/lib/public-media-section";
import { ContentScoreControl } from "@/components/admin/content-score-control";
import { useContentScoreAccess } from "@/lib/context/content-score-context";
import type { CampaignFile, DataOwnerGroup } from "@/lib/types";
import { formatPersianDate } from "@/lib/utils";

const FILES_ITEMS_PER_ROW = 2;

interface CampaignFilesSectionProps {
  files: CampaignFile[];
  groups: DataOwnerGroup<CampaignFile>[];
}

function FileList({ files }: { files: CampaignFile[] }) {
  const { canScore, campaignId } = useContentScoreAccess();

  return (
    <div className={PUBLIC_MEDIA_GRID_CLASS}>
      {files.map((file) => {
        const Icon = fileIcon(file.mimeType);
        return (
          <PublicContentCard
            key={file.id}
            scrollId={file.id}
            title={file.title}
            date={formatPersianDate(file.createdAt)}
            category={file.mimeType.split("/")[1]?.toUpperCase() || "فایل"}
            topics={file.planLabels ?? (file.planLabel ? [file.planLabel] : [])}
            ownerUserId={file.ownerUserId}
            ownerName={file.ownerName}
            media={
              <div className="flex h-full flex-col items-center justify-center gap-3 bg-muted p-4 text-center">
                <Icon className="h-16 w-16 text-primary" />
                <span className="break-all text-xs text-muted-foreground">{file.fileName}</span>
              </div>
            }
            score={
              canScore || file.score != null ? (
                <ContentScoreControl
                  campaignId={campaignId || file.campaignId}
                  contentType="file"
                  contentId={file.id}
                  score={file.score}
                  canScore={canScore}
                  compact
                />
              ) : null
            }
            actions={
              <>
                <Button variant="outline" size="sm" asChild>
                  <a href={file.fileUrl} target="_blank" rel="noopener noreferrer">
                    <Eye className="h-4 w-4" />
                    مشاهده
                  </a>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={file.fileUrl} download={file.fileName}>
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

function fileIcon(mimeType: string) {
  if (mimeType.includes("sheet") || mimeType.includes("excel")) {
    return FileSpreadsheet;
  }
  return FileText;
}

export function CampaignFilesSection({ files, groups }: CampaignFilesSectionProps) {
  const { filter } = useOwnerLocationFilter();
  const locationFilteredGroups = useFilteredOwnerGroups(groups);
  const filteredGroups = useMemo(
    () => filterGroupsByDisplayContent(locationFilteredGroups, fileHasDisplayContent),
    [locationFilteredGroups]
  );
  const filteredFiles = useMemo(
    () => flattenOwnerGroupsInSortOrder(filteredGroups, filter.sortOrder),
    [filteredGroups, filter.sortOrder]
  );
  const sectionVisible = useCampaignSectionVisibility(files.length, filteredFiles.length);

  const { effectiveCount, hasMore, loadMore, revealContentId } = useSectionPagination(
    filteredFiles.length,
    FILES_ITEMS_PER_ROW,
    3,
    `files:${filteredFiles.length}`
  );

  const fileIds = useMemo(() => filteredFiles.map((file) => file.id), [filteredFiles]);

  useCampaignContentReveal("files", fileIds, (contentId) =>
    revealContentId(contentId, fileIds)
  );

  const chronological = shouldRenderChronologically(filter.sortOrder);
  const visibleItems = useMemo(
    () => filteredFiles.slice(0, effectiveCount),
    [filteredFiles, effectiveCount]
  );
  const visibleGroups = useMemo(() => {
    const ids = new Set(visibleItems.map((file) => file.id));
    return filteredGroups
      .map((group) => ({
        ...group,
        items: group.items.filter((file) => ids.has(file.id)),
      }))
      .filter((group) => group.items.length > 0);
  }, [filteredGroups, visibleItems]);

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
          <OwnerGroupedSection
            groups={visibleGroups}
            flatItems={chronological ? visibleItems : null}
          >
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
