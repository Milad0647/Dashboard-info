"use client";

import { useMemo, useState } from "react";
import { Building2, Star, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  buildSectionTopCompanies,
  type SectionTopSort,
} from "@/lib/section-top-companies";
import type { DataOwnerGroup, Ownable } from "@/lib/types";
import { formatPersianNumber } from "@/lib/utils";

interface SectionTopCompaniesBoxProps {
  groups: DataOwnerGroup<Ownable>[];
  title?: string;
}

export function SectionTopCompaniesBox({
  groups,
  title = "۵ شرکت برتر این بخش",
}: SectionTopCompaniesBoxProps) {
  const [sort, setSort] = useState<SectionTopSort>("count");
  const companies = useMemo(
    () => buildSectionTopCompanies(groups, sort, 5),
    [groups, sort]
  );

  if (companies.length === 0) return null;

  return (
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
          <div
            key={company.key}
            className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2"
          >
            <Badge variant="secondary" className="shrink-0 tabular-nums">
              {formatPersianNumber(index + 1)}
            </Badge>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 truncate text-sm font-medium">
                <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{company.name}</span>
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span>{formatPersianNumber(company.count)} محتوا</span>
                <span className="inline-flex items-center gap-0.5">
                  <Star className="h-3 w-3 text-amber-500" />
                  {formatPersianNumber(Math.round(company.scoreTotal))}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
