"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOwnerLocationFilter } from "@/lib/context/owner-location-filter-context";
import { OWNER_LOCATION_ALL, OWNER_USER_ALL } from "@/lib/owner-location-filter";
import { MapPin, UserRound } from "lucide-react";

export function OwnerLocationFilterBar() {
  const { filter, setProvince, setCity, setUserKey, provinces, cities, users } =
    useOwnerLocationFilter();

  return (
    <div
      className="flex flex-col gap-3 rounded-xl border bg-card/60 p-4"
      data-export-hide
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <MapPin className="h-4 w-4 text-primary shrink-0" />
        <span>فیلتر محتوا بر اساس کاربر، استان و شهر</span>
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
        {users.length > 0 && (
          <Select value={filter.userKey} onValueChange={setUserKey}>
            <SelectTrigger className="w-full lg:w-52">
              <div className="flex items-center gap-2">
                <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                <SelectValue placeholder="کاربر" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={OWNER_USER_ALL}>همه کاربران</SelectItem>
              {users.map((user) => (
                <SelectItem key={user.key} value={user.key}>
                  {user.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={filter.province} onValueChange={setProvince}>
          <SelectTrigger className="w-full lg:w-44">
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
          <SelectTrigger className="w-full lg:w-44">
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
