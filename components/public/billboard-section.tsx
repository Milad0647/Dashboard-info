"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionHeader } from "@/components/public/section-header";
import { BillboardCard } from "@/components/public/billboard-card";
import { BillboardMap } from "@/components/public/billboard-map";
import { BillboardModal } from "@/components/public/billboard-modal";
import type { Billboard } from "@/lib/types";
import { getStatusLabel } from "@/lib/utils";

interface BillboardSectionProps {
  billboards: Billboard[];
}

export function BillboardSection({ billboards }: BillboardSectionProps) {
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedBillboard, setSelectedBillboard] = useState<Billboard | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const cities = useMemo(
    () => [...new Set(billboards.map((b) => b.city))],
    [billboards]
  );

  const filtered = useMemo(() => {
    return billboards.filter((b) => {
      if (cityFilter !== "all" && b.city !== cityFilter) return false;
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (search && !b.title.includes(search) && !b.city.includes(search)) return false;
      return true;
    });
  }, [billboards, cityFilter, statusFilter, search]);

  const openBillboard = (billboard: Billboard) => {
    setSelectedBillboard(billboard);
    setModalOpen(true);
  };

  return (
    <section id="billboards">
      <SectionHeader
        title="بیلبوردها"
        description="نمایش بیلبوردهای کمپین روی نقشه و کارت‌ها — داده‌های Map Bilboard به‌صورت زنده"
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="جستجو..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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
                <SelectItem key={city} value={city}>{city}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="وضعیت" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه</SelectItem>
              {["completed", "published", "draft"].map((s) => (
                <SelectItem key={s} value={s}>{getStatusLabel(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </SectionHeader>

      <div className="mb-8">
        <BillboardMap billboards={filtered} onSelect={openBillboard} />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border bg-card py-12 text-center text-muted-foreground">
          بیلبوردی یافت نشد.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((billboard) => (
            <BillboardCard key={billboard.id} billboard={billboard} onView={openBillboard} />
          ))}
        </div>
      )}

      <BillboardModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        billboard={selectedBillboard}
      />
    </section>
  );
}
