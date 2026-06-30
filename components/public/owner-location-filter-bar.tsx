"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOwnerLocationFilter } from "@/lib/context/owner-location-filter-context";
import { OWNER_LOCATION_ALL } from "@/lib/owner-location-filter";
import { MapPin } from "lucide-react";

export function OwnerLocationFilterBar() {
  const { filter, setProvince, setCity, provinces, cities } = useOwnerLocationFilter();

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border bg-card/60 p-4 sm:flex-row sm:items-center sm:justify-between"
      data-export-hide
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <MapPin className="h-4 w-4 text-primary shrink-0" />
        <span>تفکیک بر اساس استان و شهر</span>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select value={filter.province} onValueChange={setProvince}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="استان" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={OWNER_LOCATION_ALL}>همه استان‌ها</SelectItem>
            {provinces.map((province) => (
              <SelectItem key={province} value={province}>
                {province}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filter.city}
          onValueChange={setCity}
          disabled={filter.province === OWNER_LOCATION_ALL}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue
              placeholder={
                filter.province === OWNER_LOCATION_ALL ? "ابتدا استان را انتخاب کنید" : "شهر"
              }
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={OWNER_LOCATION_ALL}>همه شهرها</SelectItem>
            {cities.map((city) => (
              <SelectItem key={city} value={city}>
                {city}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
