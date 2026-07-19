"use client";

import { ArrowUpDown, Filter, RotateCcw, Sparkles, UserRound, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { Ownable } from "@/lib/types";
import { formatPlanLabelDisplay, matchesAnyPlanLabelFilter } from "@/lib/content-topics";

export const ADMIN_FILTER_ALL = "all";

export type AdminCreativeFilter = "all" | "creative" | "standard";
export type AdminContentSort = "newest" | "oldest" | "title" | "default" | "category";

export interface AdminContentFilterState {
  userKey: string;
  /** Empty array means all plan labels. */
  planLabels: string[];
  /** Only used when the section enables the creative filter (activities). */
  creative: AdminCreativeFilter;
  sortOrder: AdminContentSort;
}

export const DEFAULT_ADMIN_CONTENT_FILTER: AdminContentFilterState = {
  userKey: ADMIN_FILTER_ALL,
  planLabels: [],
  creative: ADMIN_FILTER_ALL,
  sortOrder: "newest",
};

export interface AdminFilterUserOption {
  key: string;
  label: string;
}

interface AdminContentFilterBarProps {
  filter: AdminContentFilterState;
  onChange: (next: AdminContentFilterState) => void;
  users: AdminFilterUserOption[];
  plans: string[];
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

export function matchesAdminContentFilter<T extends CreativeFilterable>(
  item: T,
  filter: AdminContentFilterState
): boolean {
  if (filter.userKey !== ADMIN_FILTER_ALL) {
    const key = item.ownerUserId ?? item.ownerEmail ?? "";
    if (key !== filter.userKey) return false;
  }

  if (!matchesAnyPlanLabelFilter(item.planLabels, item.planLabel, filter.planLabels)) {
    return false;
  }

  if (filter.creative === "creative" && !item.isCreative) return false;
  if (filter.creative === "standard" && item.isCreative) return false;

  return true;
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
  const map = new Map<string, string>();

  for (const item of items) {
    const key = item.ownerUserId ?? item.ownerEmail;
    if (!key) continue;
    const label = item.ownerName?.trim() || item.ownerEmail?.trim() || "کاربر";
    if (!map.has(key)) map.set(key, label);
  }

  return [...map.entries()]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "fa"));
}

const SORT_OPTIONS = [
  { value: "newest", label: "جدیدترین" },
  { value: "oldest", label: "قدیمی‌ترین" },
  { value: "title", label: "عنوان" },
  { value: "default", label: "ترتیب پیش‌فرض" },
];

const CATEGORY_SORT_OPTION = { value: "category", label: "دسته‌بندی" };

export function AdminContentFilterBar({
  filter,
  onChange,
  users,
  plans,
  categoryOptions = [],
  categoryValue = ADMIN_FILTER_ALL,
  onCategoryChange,
  showCreativeFilter = false,
  showCategorySort = false,
}: AdminContentFilterBarProps) {
  const hasCategoryFilter = categoryOptions.length > 0 && Boolean(onCategoryChange);
  const sortOptions = showCategorySort
    ? [
        ...SORT_OPTIONS.slice(0, 3),
        CATEGORY_SORT_OPTION,
        SORT_OPTIONS[3],
      ]
    : SORT_OPTIONS;
  const active =
    filter.userKey !== ADMIN_FILTER_ALL ||
    filter.planLabels.length > 0 ||
    filter.sortOrder !== DEFAULT_ADMIN_CONTENT_FILTER.sortOrder ||
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

  const userOptions = [
    { value: ADMIN_FILTER_ALL, label: "همه کاربران" },
    ...users.map((user) => ({ value: user.key, label: user.label })),
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
    <div className="mb-4 flex flex-col gap-3 rounded-xl border bg-card/60 p-4 text-right" dir="rtl">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-start">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Filter className="h-4 w-4 text-primary" />
          فیلتر محتوا
        </div>

        {users.length > 0 && (
          <SearchableSelect
            value={filter.userKey}
            onValueChange={(userKey) => onChange({ ...filter, userKey })}
            options={userOptions}
            placeholder="کاربر"
            searchPlaceholder="جستجوی کاربر..."
            className="w-full sm:w-64"
            leadingIcon={<UserRound className="h-4 w-4 shrink-0 text-muted-foreground" />}
          />
        )}

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
            className="w-full sm:w-56"
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
            className="w-full sm:w-56"
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
            className="w-full sm:w-56"
            leadingIcon={<Sparkles className="h-4 w-4 shrink-0 text-amber-500" />}
          />
        )}

        <SearchableSelect
          value={filter.sortOrder}
          onValueChange={(sortOrder) =>
            onChange({ ...filter, sortOrder: sortOrder as AdminContentSort })
          }
          options={sortOptions}
          placeholder="ترتیب نمایش"
          searchPlaceholder="جستجوی ترتیب..."
          className="w-full sm:w-56"
          leadingIcon={<ArrowUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
        />

        {active && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={resetFilters}
          >
            <RotateCcw className="h-4 w-4" />
            ریست فیلتر
          </Button>
        )}
      </div>

      {filter.planLabels.length > 0 && (
        <div className="flex flex-wrap items-center justify-start gap-2">
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
        </div>
      )}
    </div>
  );
}
