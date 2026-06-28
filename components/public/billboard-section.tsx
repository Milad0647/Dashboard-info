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
import { BillboardCard } from "@/components/public/billboard-card";
import { BillboardMap } from "@/components/public/billboard-map";
import { BillboardModal } from "@/components/public/billboard-modal";
import {
  PUBLIC_MEDIA_GRID_CLASS,
  sortByPublicMediaOrder,
  type PublicMediaSort,
} from "@/lib/public-media-section";
import { usePublicMediaPagination } from "@/lib/hooks/use-public-media-pagination";
import { groupByOwner, hasUserOwnedGroups } from "@/lib/owner-groups";
import type { Billboard } from "@/lib/types";
import { formatPersianNumber, getStatusLabel } from "@/lib/utils";

interface BillboardSectionProps {
  billboards: Billboard[];
}

export function BillboardSection({ billboards }: BillboardSectionProps) {
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sort, setSort] = useState<PublicMediaSort>("default");
  const [search, setSearch] = useState("");
  const [selectedBillboard, setSelectedBillboard] = useState<Billboard | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const cities = useMemo(
    () => [...new Set(billboards.map((billboard) => billboard.city))],
    [billboards]
  );

  const filtered = useMemo(() => {
    const items = billboards.filter((billboard) => {
      if (cityFilter !== "all" && billboard.city !== cityFilter) return false;
      if (statusFilter !== "all" && billboard.status !== statusFilter) return false;
      if (search && !billboard.title.includes(search) && !billboard.city.includes(search)) return false;
      return true;
    });
    return sortByPublicMediaOrder(items, sort, (item) => item.date);
  }, [billboards, cityFilter, statusFilter, search, sort]);

  const filteredGroups = useMemo(() => groupByOwner(filtered), [filtered]);
  const enablePagination = !hasUserOwnedGroups(filteredGroups);

  const { visibleCount, hasMore, loadMore } = usePublicMediaPagination(
    filtered.length,
    `${cityFilter}:${statusFilter}:${search}:${sort}`,
    enablePagination
  );

  const visibleBillboards = enablePagination ? filtered.slice(0, visibleCount) : filtered;
  const visibleGroups = useMemo(
    () => (enablePagination ? groupByOwner(visibleBillboards) : filteredGroups),
    [enablePagination, visibleBillboards, filteredGroups]
  );

  const openBillboard = (billboard: Billboard) => {
    setSelectedBillboard(billboard);
    setModalOpen(true);
  };

  const controls = (
    <>
      <Select value={sort} onValueChange={(value) => setSort(value as PublicMediaSort)}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder="مرتب‌سازی" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="default">ترتیب پیش‌فرض</SelectItem>
          <SelectItem value="title">عنوان</SelectItem>
          <SelectItem value="newest">جدیدترین</SelectItem>
        </SelectContent>
      </Select>
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
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-32">
          <SelectValue placeholder="وضعیت" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">همه</SelectItem>
          {["completed", "published", "draft"].map((status) => (
            <SelectItem key={status} value={status}>
              {getStatusLabel(status)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );

  return (
    <>
      <CollapsibleSection
        id="billboards"
        title="بیلبوردها"
        description="نمایش بیلبوردهای کمپین روی نقشه و کارت‌ها"
        controls={controls}
      >
        <div className="mb-6">
          <BillboardMap billboards={filtered} onSelect={openBillboard} />
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border bg-card py-12 text-center text-muted-foreground">
            بیلبوردی یافت نشد.
          </div>
        ) : (
          <div className="space-y-4">
            <OwnerGroupedSection groups={visibleGroups}>
              {(groupBillboards) => (
                <div className={PUBLIC_MEDIA_GRID_CLASS}>
                  {groupBillboards.map((billboard) => (
                    <BillboardCard key={billboard.id} billboard={billboard} onView={openBillboard} />
                  ))}
                </div>
              )}
            </OwnerGroupedSection>

            {enablePagination && hasMore && (
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
    </>
  );
}
