import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CollapsibleSection } from "@/components/public/collapsible-section";
import { OwnerGroupedSection } from "@/components/public/owner-grouped-section";
import type { CampaignFile, DataOwnerGroup } from "@/lib/types";
import { formatPersianNumber } from "@/lib/utils";

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
  if (files.length === 0) return null;

  return (
    <CollapsibleSection
      id="files"
      title="فایل‌های کمپین"
      description="دانلود PDF، Word، Excel و سایر فایل‌های مرتبط با کمپین"
    >
      <OwnerGroupedSection groups={groups}>
        {(groupFiles) => <FileList files={groupFiles} />}
      </OwnerGroupedSection>
    </CollapsibleSection>
  );
}
