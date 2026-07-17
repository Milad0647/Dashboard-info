"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CollapsibleSection } from "@/components/public/collapsible-section";
import { OwnerGroupedSection } from "@/components/public/owner-grouped-section";
import { SectionTopCompaniesBox } from "@/components/public/section-top-companies-box";
import { BillboardCard } from "@/components/public/billboard-card";
import { BillboardMap } from "@/components/public/billboard-map";
import {
  BillboardMapDialog,
  BillboardMapExpandButton,
} from "@/components/public/billboard-map-dialog";
import { BillboardModal } from "@/components/public/billboard-modal";
import {
  billboardHasDisplayContent,
  PUBLIC_MEDIA_GRID_CLASS,
  resolvePublicMediaSort,
  sortByPublicMediaOrder,
  type PublicMediaSort,
} from "@/lib/public-media-section";
import { usePublicMediaPagination } from "@/lib/hooks/use-public-media-pagination";
import { useFilteredOwnableItems } from "@/lib/hooks/use-filtered-owner-groups";
import { useCampaignSectionVisibility } from "@/lib/hooks/use-campaign-section-visibility";
import { useOwnerLocationFilter } from "@/lib/context/owner-location-filter-context";
import { groupByOwnerPreservingOrder, shouldRenderChronologically } from "@/lib/owner-groups";
import { hasBillboardCoordinates } from "@/lib/billboards";
import type { Billboard } from "@/lib/types";
import { formatPersianNumber, getStatusLabel } from "@/lib/utils";
import { resolveBillboardCategoryDisplay } from "@/lib/billboard-categories";

function getBillboardUploadDate(billboard: Billboard): string {
  return billboard.updatedAt || billboard.createdAt;
}

function matchesBillboardStatusFilter(billboard: Billboard, statusFilter: string): boolean {
  if (statusFilter === "all") return true;
  return billboard.status === statusFilter;
}

function matchesBillboardCategoryFilter(billboard: Billboard, categoryFilter: string): boolean {
  if (categoryFilter === "all") return true;
  return resolveBillboardCategoryDisplay(billboard) === categoryFilter;
}

interface BillboardSectionProps {
  billboards: Billboard[];
  adminOwnerLabel?: string | null;
}

export function BillboardSection({ billboards, adminOwnerLabel }: BillboardSectionProps) {
  const { filter } = useOwnerLocationFilter();
  const locationFilteredBillboards = useFilteredOwnableItems(billboards, (billboard) => billboard.date);
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sort, setSort] = useState<PublicMediaSort>("default");
  const [search, setSearch] = useState("");
  const [selectedBillboard, setSelectedBillboard] = useState<Billboard | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [mapExpanded, setMapExpanded] = useState(false);

  const cities = useMemo(
    () => [...new Set(locationFilteredBillboards.map((billboard) => billboard.city).filter(Boolean))],
    [locationFilteredBillboards]
  );

  const categories = useMemo(() => {
    const labels = locationFilteredBillboards
      .map((billboard) => resolveBillboardCategoryDisplay(billboard))
      .filter((label): label is string => Boolean(label));
    return [...new Set(labels)].sort((a, b) => a.localeCompare(b, "fa"));
  }, [locationFilteredBillboards]);

  const effectiveSort = resolvePublicMediaSort(filter.sortOrder, sort);

  const filtered = useMemo(() => {
    const items = locationFilteredBillboards.filter((billboard) => {
      if (!billboardHasDisplayContent(billboard)) return false;
      if (cityFilter !== "all" && billboard.city !== cityFilter) return false;
      if (!matchesBillboardCategoryFilter(billboard, categoryFilter)) return false;
      if (!matchesBillboardStatusFilter(billboard, statusFilter)) return false;
      if (search && !billboard.title.includes(search) && !billboard.city.includes(search)) return false;
      return true;
    });
    // Keep admin/default order unless user picks a global or local sort.
    return sortByPublicMediaOrder(items, effectiveSort, getBillboardUploadDate);
  }, [locationFilteredBillboards, cityFilter, categoryFilter, statusFilter, search, effectiveSort]);

  const sectionVisible = useCampaignSectionVisibility(billboards.length, filtered.length);

  const { visibleCount, hasMore, loadMore } = usePublicMediaPagination(
    filtered.length,
    `${cityFilter}:${categoryFilter}:${statusFilter}:${search}:${sort}`
  );

  const chronological = shouldRenderChronologically(effectiveSort);
  const visibleBillboards = filtered.slice(0, visibleCount);
  const visibleGroups = useMemo(() => {
    return groupByOwnerPreservingOrder(visibleBillboards, adminOwnerLabel ?? undefined);
  }, [visibleBillboards, adminOwnerLabel]);

  const rankingGroups = useMemo(() => {
    return groupByOwnerPreservingOrder(filtered, adminOwnerLabel ?? undefined);
  }, [filtered, adminOwnerLabel]);

  const openBillboard = (billboard: Billboard) => {
    setSelectedBillboard(billboard);
    setModalOpen(true);
  };

  if (!sectionVisible) return null;

  const controls = (
    <>
      {filter.sortOrder === "default" && (
      <Select value={sort} onValueChange={(value) => setSort(value as PublicMediaSort)}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder="مرتب‌سازی" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default">ترتیب پیش‌فرض</SelectItem>
          <SelectItem value="title">عنوان</SelectItem>
          <SelectItem value="newest">جدیدترین</SelectItem>
          <SelectItem value="oldest">قدیمی‌ترین</SelectItem>
        </SelectContent>
      </Select>
      )}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="جستجو..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-40 pr-9"
        />
      </div>
      <Select value={cityFilter} onValueChange={setCityFilter}>
        <SelectTrigger className="w-32">
          <SelectValue placeholder="شهر" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">همه شهرها</SelectItem>
          {cities.map((city) => (
            <SelectItem key={city} value={city}>
              {city}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {categories.length > 0 && (
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="دسته‌بندی" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه دسته‌ها</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-32">
          <SelectValue placeholder="وضعیت" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">همه</SelectItem>
          <SelectItem value="completed">{getStatusLabel("completed")}</SelectItem>
        </SelectContent>
      </Select>
    </>
  );

  return (
    <>
      <CollapsibleSection
        id="billboards"
        title="تبلیغات محیطی"
        description={`${formatPersianNumber(filtered.length)} مورد — نمایش روی نقشه و کارت‌ها`}
        controls={controls}
      >
        <SectionTopCompaniesBox groups={rankingGroups} />
        <div className="mb-6 space-y-3">
          <div className="flex justify-end">
            <BillboardMapExpandButton
              onClick={() => setMapExpanded(true)}
              disabled={locationFilteredBillboards.filter(hasBillboardCoordinates).length === 0}
            />
          </div>
          <BillboardMap billboards={locationFilteredBillboards} onSelect={openBillboard} />
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border bg-card py-12 text-center text-muted-foreground">
            بیلبوردی یافت نشد.
          </div>
        ) : (
          <div className="space-y-4">
            <OwnerGroupedSection
              groups={visibleGroups}
              flatItems={chronological ? visibleBillboards : null}
            >
              {(groupBillboards) => (
                <div className={PUBLIC_MEDIA_GRID_CLASS}>
                  {groupBillboards.map((billboard) => (
                    <BillboardCard key={billboard.id} billboard={billboard} onView={openBillboard} />
                  ))}
                </div>
              )}
            </OwnerGroupedSection>

            {hasMore && (
              <div className="flex justify-center" data-export-hide>
                <Button variant="outline" onClick={loadMore}>
                  مشاهده بیشتر ({formatPersianNumber(filtered.length - visibleCount)} باقی‌مانده)
                </Button>
              </div>
            )}
          </div>
        )}
      </CollapsibleSection>

      <BillboardModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        billboard={selectedBillboard}
      />

      <BillboardMapDialog
        open={mapExpanded}
        onOpenChange={setMapExpanded}
        billboards={locationFilteredBillboards}
        onSelect={openBillboard}
      />
    </>
  );
}
