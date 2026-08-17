"use client";

import {
  ArrowUpDown,
  Building2,
  CalendarRange,
  MapPin,
  RotateCcw,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PersianDateInput } from "@/components/ui/persian-date-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { Ownable } from "@/lib/types";
import { formatPlanLabelDisplay, matchesAnyPlanLabelFilter } from "@/lib/content-topics";
import { EmptyFieldFilterSelect } from "@/components/admin/empty-field-filter-select";
import { matchesDateFilter } from "@/lib/campaign-content-filter";
import {
  matchesEmptyFieldFilter,
  type EmptyFieldFilter,
} from "@/lib/empty-content-fields";
import { matchesContentSearch } from "@/lib/owner-location-filter";
import {
  USER_COMPANY_TYPES,
  getUserCompanyTypeLabel,
  type UserCompanyType,
} from "@/lib/user-company-types";

export const ADMIN_FILTER_ALL = "all";

export type AdminCreativeFilter = "all" | "creative" | "standard";
export type AdminContentSort = "newest" | "oldest" | "title" | "default" | "category";
export type AdminCompanyTypeFilter = "all" | UserCompanyType;
export type AdminDatePreset = "all" | "today" | "this_week" | "this_month" | "custom";

export interface AdminContentFilterState {
  userKey: string;
  /** Empty array means all plan labels. */
  planLabels: string[];
  /** Filter by owner company type (distribution / regional_electricity). */
  companyType: AdminCompanyTypeFilter;
  /** Only used when the section enables the creative filter (activities). */
  creative: AdminCreativeFilter;
  sortOrder: AdminContentSort;
  searchQuery: string;
  province: string;
  city: string;
  datePreset: AdminDatePreset;
  dateFrom: string;
  dateTo: string;
  /** Filter items missing topic / screening location / area. */
  emptyField: EmptyFieldFilter;
}

export const DEFAULT_ADMIN_CONTENT_FILTER: AdminContentFilterState = {
  userKey: ADMIN_FILTER_ALL,
  planLabels: [],
  companyType: ADMIN_FILTER_ALL,
  creative: ADMIN_FILTER_ALL,
  sortOrder: "newest",
  searchQuery: "",
  province: ADMIN_FILTER_ALL,
  city: ADMIN_FILTER_ALL,
  datePreset: ADMIN_FILTER_ALL,
  dateFrom: "",
  dateTo: "",
  emptyField: "all",
};

export interface AdminFilterUserOption {
  key: string;
  label: string;
  province?: string | null;
  city?: string | null;
  companyType?: UserCompanyType | null;
}

export interface AdminFilterLocations {
  provinces: string[];
  citiesByProvince: Record<string, string[]>;
}

interface AdminContentFilterBarProps {
  filter: AdminContentFilterState;
  onChange: (next: AdminContentFilterState) => void;
  users: AdminFilterUserOption[];
  plans: string[];
  locations?: AdminFilterLocations;
  /** Optional category labels (e.g. billboard structure types). */
  categoryOptions?: string[];
  categoryValue?: string;
  onCategoryChange?: (value: string) => void;
  /** Show creative / standard filter (activities). */
  showCreativeFilter?: boolean;
  /** When true, includes sort-by-category in the order dropdown. */
  showCategorySort?: boolean;
}

type CreativeFilterable = Ownable & { isCreative?: boolean };

type SortableAdminItem = {
  title?: string | null;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
};

function resolveItemProvince(item: Ownable): string | null {
  const ownerProvince = item.ownerProvince?.trim();
  if (ownerProvince) return ownerProvince;
  const geoProvince =
    "province" in item && typeof (item as { province?: unknown }).province === "string"
      ? (item as { province?: string | null }).province?.trim()
      : undefined;
  return geoProvince || null;
}

function resolveItemCity(item: Ownable): string | null {
  const ownerCity = item.ownerCity?.trim();
  if (ownerCity) return ownerCity;
  const geoCity =
    "city" in item && typeof (item as { city?: unknown }).city === "string"
      ? (item as { city?: string | null }).city?.trim()
      : undefined;
  return geoCity || null;
}

function matchesAdminLocation(item: Ownable, filter: AdminContentFilterState): boolean {
  if (filter.province === ADMIN_FILTER_ALL) return true;

  const itemProvince = resolveItemProvince(item);
  if (!itemProvince || itemProvince !== filter.province) return false;
  if (filter.city === ADMIN_FILTER_ALL) return true;

  const itemCity = resolveItemCity(item);
  return Boolean(itemCity && itemCity === filter.city);
}

export function matchesAdminContentFilter<T extends CreativeFilterable>(
  item: T,
  filter: AdminContentFilterState,
  getItemDate?: (item: T) => string | undefined
): boolean {
  if (filter.userKey !== ADMIN_FILTER_ALL) {
    const key = item.ownerUserId ?? item.ownerEmail ?? "";
    if (key !== filter.userKey) return false;
  }

  if (filter.companyType !== ADMIN_FILTER_ALL) {
    if (item.ownerCompanyType !== filter.companyType) return false;
  }

  if (!matchesAnyPlanLabelFilter(item.planLabels, item.planLabel, filter.planLabels)) {
    return false;
  }

  if (filter.creative === "creative" && !item.isCreative) return false;
  if (filter.creative === "standard" && item.isCreative) return false;

  if (
    !matchesContentSearch(item, {
      searchQuery: filter.searchQuery,
      province: filter.province,
      city: filter.city,
      userKey: filter.userKey,
      planLabels: filter.planLabels,
      companyType: filter.companyType,
      datePreset: filter.datePreset,
      dateFrom: filter.dateFrom,
      dateTo: filter.dateTo,
      sortOrder: "default",
    })
  ) {
    return false;
  }

  if (!matchesAdminLocation(item, filter)) return false;

  if (!matchesEmptyFieldFilter(item, filter.emptyField ?? "all")) return false;

  return matchesDateFilter(
    item,
    {
      datePreset: filter.datePreset,
      dateFrom: filter.dateFrom,
      dateTo: filter.dateTo,
    },
    getItemDate as ((item: Ownable) => string | undefined) | undefined
  );
}

export function sortAdminContentItems<T extends SortableAdminItem>(
  items: T[],
  sort: AdminContentSort,
  getDate?: (item: T) => string | undefined,
  getTitle?: (item: T) => string,
  getCategory?: (item: T) => string
): T[] {
  const copy = [...items];
  const resolveDate = (item: T) => getDate?.(item) ?? item.updatedAt ?? item.createdAt ?? "";
  const resolveTitle = (item: T) => getTitle?.(item) ?? item.title ?? "";

  if (sort === "title") {
    return copy.sort((a, b) => resolveTitle(a).localeCompare(resolveTitle(b), "fa"));
  }

  if (sort === "newest") {
    return copy.sort((a, b) => resolveDate(b).localeCompare(resolveDate(a)));
  }

  if (sort === "oldest") {
    return copy.sort((a, b) => resolveDate(a).localeCompare(resolveDate(b)));
  }

  if (sort === "category" && getCategory) {
    return copy.sort((a, b) => getCategory(a).localeCompare(getCategory(b), "fa"));
  }

  return copy.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export function collectAdminFilterUsers(items: Ownable[]): AdminFilterUserOption[] {
  const map = new Map<string, AdminFilterUserOption>();

  for (const item of items) {
    const key = item.ownerUserId ?? item.ownerEmail;
    if (!key) continue;
    const label = item.ownerName?.trim() || item.ownerEmail?.trim() || "کاربر";
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        key,
        label,
        province: resolveItemProvince(item),
        city: resolveItemCity(item),
        companyType: item.ownerCompanyType ?? null,
      });
      continue;
    }

    if (!existing.province) existing.province = resolveItemProvince(item);
    if (!existing.city) existing.city = resolveItemCity(item);
    if (!existing.companyType && item.ownerCompanyType) {
      existing.companyType = item.ownerCompanyType;
    }
  }

  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, "fa"));
}

export function collectAdminFilterLocations(items: Ownable[]): AdminFilterLocations {
  const provinceSet = new Set<string>();
  const citiesByProvince = new Map<string, Set<string>>();

  for (const item of items) {
    const province = resolveItemProvince(item);
    if (!province) continue;
    provinceSet.add(province);
    if (!citiesByProvince.has(province)) {
      citiesByProvince.set(province, new Set());
    }
    const city = resolveItemCity(item);
    if (city) citiesByProvince.get(province)?.add(city);
  }

  const provinces = [...provinceSet].sort((a, b) => a.localeCompare(b, "fa"));
  const citiesRecord: Record<string, string[]> = {};
  for (const province of provinces) {
    citiesRecord[province] = [...(citiesByProvince.get(province) ?? [])].sort((a, b) =>
      a.localeCompare(b, "fa")
    );
  }

  return { provinces, citiesByProvince: citiesRecord };
}

export function collectAdminFilterLocationsFromUsers(
  users: Array<{ province?: string | null; city?: string | null }>
): AdminFilterLocations {
  const provinceSet = new Set<string>();
  const citiesByProvince = new Map<string, Set<string>>();

  for (const user of users) {
    const province = user.province?.trim();
    if (!province) continue;
    provinceSet.add(province);
    if (!citiesByProvince.has(province)) {
      citiesByProvince.set(province, new Set());
    }
    const city = user.city?.trim();
    if (city) citiesByProvince.get(province)?.add(city);
  }

  const provinces = [...provinceSet].sort((a, b) => a.localeCompare(b, "fa"));
  const citiesRecord: Record<string, string[]> = {};
  for (const province of provinces) {
    citiesRecord[province] = [...(citiesByProvince.get(province) ?? [])].sort((a, b) =>
      a.localeCompare(b, "fa")
    );
  }

  return { provinces, citiesByProvince: citiesRecord };
}

export function mergeAdminFilterLocations(
  ...lists: AdminFilterLocations[]
): AdminFilterLocations {
  const provinceSet = new Set<string>();
  const citiesByProvince = new Map<string, Set<string>>();

  for (const list of lists) {
    for (const province of list.provinces) {
      provinceSet.add(province);
      if (!citiesByProvince.has(province)) {
        citiesByProvince.set(province, new Set());
      }
      for (const city of list.citiesByProvince[province] ?? []) {
        citiesByProvince.get(province)?.add(city);
      }
    }
  }

  const provinces = [...provinceSet].sort((a, b) => a.localeCompare(b, "fa"));
  const citiesRecord: Record<string, string[]> = {};
  for (const province of provinces) {
    citiesRecord[province] = [...(citiesByProvince.get(province) ?? [])].sort((a, b) =>
      a.localeCompare(b, "fa")
    );
  }

  return { provinces, citiesByProvince: citiesRecord };
}

export function adminUsersToFilterOptions(
  users: Array<{
    id: string;
    name?: string | null;
    email?: string | null;
    province?: string | null;
    city?: string | null;
    companyType?: UserCompanyType | null;
  }>
): AdminFilterUserOption[] {
  return users
    .map((user) => ({
      key: user.id,
      label: user.name?.trim() || user.email?.trim() || "کاربر",
      province: user.province,
      city: user.city,
      companyType: user.companyType ?? null,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "fa"));
}

export function buildAdminFilterSources(
  items: Ownable[],
  users: Array<{
    id: string;
    name?: string | null;
    email?: string | null;
    province?: string | null;
    city?: string | null;
    companyType?: UserCompanyType | null;
  }> = [],
  enabled = true
): { users: AdminFilterUserOption[]; locations: AdminFilterLocations } {
  const locations = mergeAdminFilterLocations(
    collectAdminFilterLocations(items),
    collectAdminFilterLocationsFromUsers(users)
  );
  if (!enabled) {
    return { users: [], locations };
  }
  const fromUsers = adminUsersToFilterOptions(users);
  return {
    users: fromUsers.length > 0 ? fromUsers : collectAdminFilterUsers(items),
    locations,
  };
}

export function adminContentFilterResetKey(
  filter: AdminContentFilterState,
  ...extras: Array<string | number | boolean | null | undefined>
): string {
  return [
    filter.userKey,
    filter.companyType,
    filter.planLabels.join(","),
    filter.creative,
    filter.sortOrder,
    filter.searchQuery,
    filter.province,
    filter.city,
    filter.datePreset,
    filter.dateFrom,
    filter.dateTo,
    filter.emptyField,
    ...extras.map((value) => String(value ?? "")),
  ].join(":");
}

const SORT_OPTIONS = [
  { value: "newest", label: "جدیدترین آپلود" },
  { value: "oldest", label: "قدیمی‌ترین آپلود" },
  { value: "title", label: "عنوان" },
  { value: "default", label: "ترتیب پیش‌فرض" },
];

const CATEGORY_SORT_OPTION = { value: "category", label: "دسته‌بندی" };

const EMPTY_LOCATIONS: AdminFilterLocations = {
  provinces: [],
  citiesByProvince: {},
};

export function AdminContentFilterBar({
  filter,
  onChange,
  users,
  plans,
  locations = EMPTY_LOCATIONS,
  categoryOptions = [],
  categoryValue = ADMIN_FILTER_ALL,
  onCategoryChange,
  showCreativeFilter = false,
  showCategorySort = false,
}: AdminContentFilterBarProps) {
  const hasCategoryFilter = categoryOptions.length > 0 && Boolean(onCategoryChange);
  const sortOptions = showCategorySort
    ? [...SORT_OPTIONS.slice(0, 3), CATEGORY_SORT_OPTION, SORT_OPTIONS[3]]
    : SORT_OPTIONS;

  const cities =
    filter.province === ADMIN_FILTER_ALL
      ? []
      : (locations.citiesByProvince[filter.province] ?? []);

  const active =
    filter.userKey !== ADMIN_FILTER_ALL ||
    filter.planLabels.length > 0 ||
    filter.companyType !== ADMIN_FILTER_ALL ||
    filter.sortOrder !== DEFAULT_ADMIN_CONTENT_FILTER.sortOrder ||
    filter.searchQuery.trim().length > 0 ||
    filter.province !== ADMIN_FILTER_ALL ||
    filter.city !== ADMIN_FILTER_ALL ||
    filter.datePreset !== ADMIN_FILTER_ALL ||
    filter.dateFrom.trim().length > 0 ||
    filter.dateTo.trim().length > 0 ||
    filter.emptyField !== DEFAULT_ADMIN_CONTENT_FILTER.emptyField ||
    (showCreativeFilter && filter.creative !== ADMIN_FILTER_ALL) ||
    (hasCategoryFilter && categoryValue !== ADMIN_FILTER_ALL);

  const togglePlan = (plan: string) => {
    const exists = filter.planLabels.includes(plan);
    onChange({
      ...filter,
      planLabels: exists
        ? filter.planLabels.filter((label) => label !== plan)
        : [...filter.planLabels, plan],
    });
  };

  const setUserKey = (userKey: string) => {
    if (userKey === ADMIN_FILTER_ALL) {
      onChange({
        ...filter,
        userKey: ADMIN_FILTER_ALL,
      });
      return;
    }

    const user = users.find((item) => item.key === userKey);
    onChange({
      ...filter,
      userKey,
      province:
        filter.province !== ADMIN_FILTER_ALL
          ? filter.province
          : user?.province?.trim() || filter.province,
      city:
        filter.city !== ADMIN_FILTER_ALL ? filter.city : user?.city?.trim() || filter.city,
      companyType:
        filter.companyType !== ADMIN_FILTER_ALL
          ? filter.companyType
          : (user?.companyType ?? filter.companyType),
    });
  };

  const setProvince = (province: string) => {
    onChange({
      ...filter,
      province,
      city: ADMIN_FILTER_ALL,
    });
  };

  const userOptions = [
    { value: ADMIN_FILTER_ALL, label: "همه شرکت‌ها" },
    ...users.map((user) => ({
      value: user.key,
      label: user.label,
      keywords: `${user.province ?? ""} ${user.city ?? ""}`,
    })),
  ];

  const companyTypeOptions = [
    { value: ADMIN_FILTER_ALL, label: "همه انواع شرکت" },
    ...USER_COMPANY_TYPES.map((companyType) => ({
      value: companyType,
      label: getUserCompanyTypeLabel(companyType),
    })),
  ];

  const provinceOptions = [
    { value: ADMIN_FILTER_ALL, label: "همه استان‌ها" },
    ...locations.provinces.map((province) => ({ value: province, label: province })),
  ];

  const cityOptions = [
    { value: ADMIN_FILTER_ALL, label: "همه شهرها" },
    ...cities.map((city) => ({ value: city, label: city })),
  ];

  const planOptions = plans
    .filter((plan) => !filter.planLabels.includes(plan))
    .map((plan) => ({
      value: plan,
      label: formatPlanLabelDisplay(plan),
      keywords: plan,
    }));

  const categorySelectOptions = [
    { value: ADMIN_FILTER_ALL, label: "همه دسته‌ها" },
    ...categoryOptions.map((category) => ({ value: category, label: category })),
  ];

  const creativeOptions = [
    { value: "all", label: "همه اقدامات" },
    { value: "creative", label: "فقط خلاقانه" },
    { value: "standard", label: "بدون خلاقانه" },
  ];

  const resetFilters = () => {
    onChange(DEFAULT_ADMIN_CONTENT_FILTER);
    onCategoryChange?.(ADMIN_FILTER_ALL);
  };

  return (
    <div className="mb-4 flex flex-col gap-4 rounded-xl border bg-card/60 p-4 text-right" dir="rtl">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <MapPin className="h-4 w-4 shrink-0 text-primary" />
          <span>فیلتر و مرتب‌سازی محتوای کمپین</span>
        </div>
        {active && (
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={resetFilters}>
            <RotateCcw className="h-4 w-4" />
            بازگشت به پیش‌فرض
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filter.searchQuery}
          onChange={(event) => onChange({ ...filter, searchQuery: event.target.value })}
          placeholder="جستجو در عنوان، توضیحات، شهر، شرکت..."
          className="pr-9"
          aria-label="جستجوی محتوا"
        />
        {filter.searchQuery.trim() && (
          <button
            type="button"
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => onChange({ ...filter, searchQuery: "" })}
            aria-label="پاک کردن جستجو"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {users.length > 0 && (
          <SearchableSelect
            value={filter.userKey}
            onValueChange={setUserKey}
            options={userOptions}
            placeholder="شرکت"
            searchPlaceholder="جستجوی شرکت..."
            leadingIcon={<Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />}
          />
        )}

        <SearchableSelect
          value={filter.companyType}
          onValueChange={(companyType) =>
            onChange({ ...filter, companyType: companyType as AdminCompanyTypeFilter })
          }
          options={companyTypeOptions}
          placeholder="نوع شرکت"
          searchPlaceholder="جستجوی نوع شرکت..."
        />

        <SearchableSelect
          value={filter.province}
          onValueChange={setProvince}
          options={provinceOptions}
          placeholder="استان"
          searchPlaceholder="جستجوی استان..."
        />

        <SearchableSelect
          value={filter.city}
          onValueChange={(city) => onChange({ ...filter, city })}
          options={cityOptions}
          placeholder={
            filter.province === ADMIN_FILTER_ALL ? "ابتدا استان را انتخاب کنید" : "شهر"
          }
          searchPlaceholder="جستجوی شهر..."
          disabled={filter.province === ADMIN_FILTER_ALL}
        />

        <Select
          value={filter.datePreset}
          onValueChange={(value) =>
            onChange({ ...filter, datePreset: value as AdminDatePreset })
          }
        >
          <SelectTrigger className="w-full">
            <div className="flex items-center gap-2">
              <CalendarRange className="h-4 w-4 shrink-0 text-muted-foreground" />
              <SelectValue placeholder="بازه زمانی" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ADMIN_FILTER_ALL}>همه زمان‌ها</SelectItem>
            <SelectItem value="today">امروز</SelectItem>
            <SelectItem value="this_week">۷ روز اخیر</SelectItem>
            <SelectItem value="this_month">۳۰ روز اخیر</SelectItem>
            <SelectItem value="custom">تاریخ دستی</SelectItem>
          </SelectContent>
        </Select>

        <EmptyFieldFilterSelect
          value={filter.emptyField}
          onChange={(emptyField) => onChange({ ...filter, emptyField })}
        />

        <Select
          value={filter.sortOrder}
          onValueChange={(value) =>
            onChange({ ...filter, sortOrder: value as AdminContentSort })
          }
        >
          <SelectTrigger className="w-full">
            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              <SelectValue placeholder="ترتیب نمایش" />
            </div>
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {plans.length > 0 && (
          <SearchableSelect
            key={filter.planLabels.join("|")}
            value=""
            onValueChange={(value) => {
              if (!filter.planLabels.includes(value)) togglePlan(value);
            }}
            options={planOptions}
            placeholder="افزودن موضوع"
            searchPlaceholder="جستجوی موضوع..."
            clearAfterSelect
            emptyText="موضوعی برای افزودن نیست"
          />
        )}

        {hasCategoryFilter && onCategoryChange && (
          <SearchableSelect
            value={categoryValue}
            onValueChange={onCategoryChange}
            options={categorySelectOptions}
            placeholder="دسته سازه"
            searchPlaceholder="جستجوی دسته..."
          />
        )}

        {showCreativeFilter && (
          <SearchableSelect
            value={filter.creative}
            onValueChange={(creative) =>
              onChange({ ...filter, creative: creative as AdminCreativeFilter })
            }
            options={creativeOptions}
            placeholder="نوع اقدام"
            searchPlaceholder="جستجو..."
            leadingIcon={<Sparkles className="h-4 w-4 shrink-0 text-amber-500" />}
          />
        )}
      </div>

      {filter.planLabels.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">موضوع‌های انتخاب‌شده:</span>
          {filter.planLabels.map((label) => (
            <Badge key={label} variant="secondary" className="gap-1 pl-1">
              {formatPlanLabelDisplay(label)}
              <button
                type="button"
                className="rounded-sm p-0.5 hover:bg-muted"
                onClick={() => togglePlan(label)}
                aria-label={`حذف ${label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange({ ...filter, planLabels: [] })}>
            پاک کردن موضوع‌ها
          </Button>
        </div>
      )}

      {filter.datePreset === "custom" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">از تاریخ</label>
            <PersianDateInput
              value={filter.dateFrom}
              onChange={(dateFrom) => onChange({ ...filter, dateFrom })}
              allowEmpty
              placeholder="از تاریخ"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">تا تاریخ</label>
            <PersianDateInput
              value={filter.dateTo}
              onChange={(dateTo) => onChange({ ...filter, dateTo })}
              allowEmpty
              placeholder="تا تاریخ"
            />
          </div>
        </div>
      )}
    </div>
  );
}
