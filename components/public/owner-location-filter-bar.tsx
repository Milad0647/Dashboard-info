"use client";

import { CalendarRange, MapPin, UserRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOwnerLocationFilter } from "@/lib/context/owner-location-filter-context";
import {
  OWNER_DATE_ALL,
  OWNER_LOCATION_ALL,
  OWNER_PLAN_ALL,
  OWNER_USER_ALL,
  type CampaignContentSort,
  type CampaignDatePreset,
} from "@/lib/owner-location-filter";

export function OwnerLocationFilterBar() {
  const {
    filter,
    setProvince,
    setCity,
    setUserKey,
    setDatePreset,
    setDateFrom,
    setDateTo,
    setSortOrder,
    setPlanLabel,
    provinces,
    cities,
    plans,
    users,
  } = useOwnerLocationFilter();

  const userLocked = filter.userKey !== OWNER_USER_ALL;
  const provinceLocked = userLocked && filter.province !== OWNER_LOCATION_ALL;
  const cityLocked = userLocked && filter.city !== OWNER_LOCATION_ALL;

  return (
    <div
      className="flex flex-col gap-4 rounded-xl border bg-card/60 p-4"
      data-export-hide
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <MapPin className="h-4 w-4 text-primary shrink-0" />
        <span>فیلتر و مرتب‌سازی محتوای کمپین</span>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {users.length > 0 && (
          <Select value={filter.userKey} onValueChange={setUserKey}>
            <SelectTrigger className="w-full">
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
                  {user.province ? ` — ${user.province}${user.city ? ` / ${user.city}` : ""}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select
          value={filter.province}
          onValueChange={setProvince}
          disabled={provinceLocked}
        >
          <SelectTrigger className="w-full">
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
          disabled={filter.province === OWNER_LOCATION_ALL || cityLocked}
        >
          <SelectTrigger className="w-full">
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

        <Select
          value={filter.datePreset}
          onValueChange={(value) => setDatePreset(value as CampaignDatePreset)}
        >
          <SelectTrigger className="w-full">
            <div className="flex items-center gap-2">
              <CalendarRange className="h-4 w-4 shrink-0 text-muted-foreground" />
              <SelectValue placeholder="بازه زمانی" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={OWNER_DATE_ALL}>همه زمان‌ها</SelectItem>
            <SelectItem value="this_week">این هفته</SelectItem>
            <SelectItem value="this_month">این ماه</SelectItem>
            <SelectItem value="custom">تاریخ دستی</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filter.sortOrder}
          onValueChange={(value) => setSortOrder(value as CampaignContentSort)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="مرتب‌سازی" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">ترتیب پیش‌فرض</SelectItem>
            <SelectItem value="newest">جدیدترین</SelectItem>
            <SelectItem value="oldest">قدیمی‌ترین</SelectItem>
          </SelectContent>
        </Select>

        {plans.length > 0 && (
          <Select value={filter.planLabel} onValueChange={setPlanLabel}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="طرح" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={OWNER_PLAN_ALL}>همه طرح‌ها</SelectItem>
              {plans.map((plan) => (
                <SelectItem key={plan} value={plan}>
                  {plan}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {filter.datePreset === "custom" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">از تاریخ</label>
            <Input
              type="date"
              value={filter.dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">تا تاریخ</label>
            <Input
              type="date"
              value={filter.dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
