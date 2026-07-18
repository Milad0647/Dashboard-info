"use client";

import { Filter, RotateCcw, Sparkles, UserRound, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { Ownable } from "@/lib/types";
import { formatPlanLabelDisplay, matchesAnyPlanLabelFilter } from "@/lib/content-topics";

export const ADMIN_FILTER_ALL = "all";

export type AdminCreativeFilter = "all" | "creative" | "standard";

export interface AdminContentFilterState {
  userKey: string;
  /** Empty array means all plan labels. */
  planLabels: string[];
  /** Only used when the section enables the creative filter (activities). */
  creative: AdminCreativeFilter;
}

export const DEFAULT_ADMIN_CONTENT_FILTER: AdminContentFilterState = {
  userKey: ADMIN_FILTER_ALL,
  planLabels: [],
  creative: ADMIN_FILTER_ALL,
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
}

type CreativeFilterable = Ownable & { isCreative?: boolean };

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

export function AdminContentFilterBar({
  filter,
  onChange,
  users,
  plans,
  categoryOptions = [],
  categoryValue = ADMIN_FILTER_ALL,
  onCategoryChange,
  showCreativeFilter = false,
}: AdminContentFilterBarProps) {
  const hasCategoryFilter = categoryOptions.length > 0 && Boolean(onCategoryChange);
  const active =
    filter.userKey !== ADMIN_FILTER_ALL ||
    filter.planLabels.length > 0 ||
    (showCreativeFilter && filter.creative !== ADMIN_FILTER_ALL) ||
    (hasCategoryFilter && categoryValue !== ADMIN_FILTER_ALL);

  if (users.length === 0 && plans.length === 0 && !hasCategoryFilter && !showCreativeFilter) {
    return null;
  }

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
