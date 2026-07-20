"use client";

import { useMemo, useState } from "react";
import { Building2, Star, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LeaderboardBillboardsModal } from "@/components/public/leaderboard-billboards-modal";
import { LeaderboardContentModal } from "@/components/public/leaderboard-content-modal";
import { SectionDownloadableContentModal } from "@/components/public/section-downloadable-content-modal";
import {
  asBillboardItems,
  asBroadcastItems,
  asRawMediaItems,
  buildSectionTopCompanies,
  collectCompanyItemsFromGroups,
  isLeaderboardMetricKind,
  mapSectionItemsToLeaderboardContent,
  SECTION_CONTENT_KIND_LABEL,
  sectionKindToMetricLabel,
  type SectionContentKind,
  type SectionTopCompany,
  type SectionTopSort,
} from "@/lib/section-top-companies";
import type { DataOwnerGroup, Ownable } from "@/lib/types";
import { formatPersianNumber } from "@/lib/utils";

interface SectionTopCompaniesBoxProps {
  groups: DataOwnerGroup<Ownable>[];
  contentKind: SectionContentKind;
  title?: string;
}

export function SectionTopCompaniesBox({
  groups,
  contentKind,
  title = "۵ شرکت برتر این بخش",
}: SectionTopCompaniesBoxProps) {
  const [sort, setSort] = useState<SectionTopSort>("count");
  const [selectedCompany, setSelectedCompany] = useState<SectionTopCompany | null>(null);

  const companies = useMemo(
    () => buildSectionTopCompanies(groups, sort, 5),
    [groups, sort]
  );

  const companyItems = useMemo(
    () =>
      selectedCompany
        ? collectCompanyItemsFromGroups(groups, selectedCompany.key)
        : [],
    [groups, selectedCompany]
  );

  const sectionLabel = SECTION_CONTENT_KIND_LABEL[contentKind];

  if (companies.length === 0) return null;

  return (
    <>
      <div className="mb-4 rounded-xl border bg-muted/30 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Trophy className="h-4 w-4 text-primary" />
            {title}
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="sm"
              variant={sort === "count" ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => setSort("count")}
            >
              بیشترین آپلود
            </Button>
            <Button
              type="button"
              size="sm"
              variant={sort === "score" ? "default" : "outline"}
              className="h-7 text-xs"
              onClick={() => setSort("score")}
            >
              بر اساس امتیاز
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {companies.map((company, index) => (
            <button
              key={company.key}
              type="button"
              onClick={() => setSelectedCompany(company)}
              className="apple-press flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-right transition-colors hover:border-primary/50 hover:bg-muted/40 hover:shadow-sm"
            >
              <Badge variant="secondary" className="shrink-0 tabular-nums">
                {formatPersianNumber(index + 1)}
              </Badge>
              <div className="min-w-0 flex-1">
                <p className="flex items-start gap-1 text-sm font-medium leading-snug">
                  <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="break-words">{company.name}</span>
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{formatPersianNumber(company.count)} محتوا</span>
                  <span className="inline-flex items-center gap-0.5">
                    <Star className="h-3 w-3 text-warning" />
                    {formatPersianNumber(Math.round(company.scoreTotal))}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          برای مشاهده و راستی‌آزمایی محتوا، روی نام شرکت کلیک کنید.
        </p>
      </div>

      {contentKind === "billboard" && (
        <LeaderboardBillboardsModal
          open={Boolean(selectedCompany)}
          onOpenChange={(open) => {
            if (!open) setSelectedCompany(null);
          }}
          title={selectedCompany?.name ?? ""}
          billboards={asBillboardItems(companyItems)}
        />
      )}

      {isLeaderboardMetricKind(contentKind) && (
        <LeaderboardContentModal
          open={Boolean(selectedCompany)}
          onOpenChange={(open) => {
            if (!open) setSelectedCompany(null);
          }}
          metricLabel={sectionKindToMetricLabel(contentKind)}
          title={selectedCompany?.name ?? ""}
          items={mapSectionItemsToLeaderboardContent(contentKind, companyItems)}
        />
      )}

      {(contentKind === "raw_media" || contentKind === "broadcast") && (
        <SectionDownloadableContentModal
          open={Boolean(selectedCompany)}
          onOpenChange={(open) => {
            if (!open) setSelectedCompany(null);
          }}
          title={selectedCompany?.name ?? ""}
          sectionLabel={sectionLabel}
          items={
            contentKind === "raw_media"
              ? asRawMediaItems(companyItems).map((item) => ({ kind: "raw_media" as const, item }))
              : asBroadcastItems(companyItems).map((item) => ({ kind: "broadcast" as const, item }))
          }
        />
      )}
    </>
  );
}
