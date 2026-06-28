import type { BroadcastReport, DataOwnerGroup } from "@/lib/types";
import { formatPersianDate } from "@/lib/utils";
import { OwnerGroupedSection } from "@/components/public/owner-grouped-section";
import { SectionHeader } from "@/components/public/section-header";
import { Button } from "@/components/ui/button";
import { Download, FileText } from "lucide-react";

interface BroadcastSectionProps {
  reports: BroadcastReport[];
  groups: DataOwnerGroup<BroadcastReport>[];
}

function BroadcastReportCard({ report }: { report: BroadcastReport }) {
  const { summaryData } = report;

  return (
    <article className="rounded-xl border bg-card p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <h3 className="font-semibold">{report.title}</h3>
        </div>
        <p className="text-sm text-muted-foreground">{formatPersianDate(report.reportDate)}</p>
        {summaryData.notes && (
          <p className="text-sm text-muted-foreground">{summaryData.notes}</p>
        )}
      </div>
      <Button variant="outline" asChild className="shrink-0">
        <a href={report.pdfUrl} target="_blank" rel="noreferrer" download={report.fileName}>
          <Download className="h-4 w-4" />
          دانلود PDF
        </a>
      </Button>
    </article>
  );
}

export function BroadcastSection({ reports, groups }: BroadcastSectionProps) {
  if (reports.length === 0) return null;

  return (
    <section id="broadcast-reports">
      <SectionHeader
        title="گزارش پخش صدا و سیما"
        description="گزارش‌های PDF روزانه"
      />

      <OwnerGroupedSection groups={groups}>
        {(groupReports) => (
          <div className="space-y-4">
            {groupReports.map((report) => (
              <BroadcastReportCard key={report.id} report={report} />
            ))}
          </div>
        )}
      </OwnerGroupedSection>
    </section>
  );
}
