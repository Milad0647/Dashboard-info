"use client";

import { Filter, RotateCcw, UserRound, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { Ownable } from "@/lib/types";
import { formatPlanLabelDisplay, matchesAnyPlanLabelFilter } from "@/lib/content-topics";

export const ADMIN_FILTER_ALL = "all";

export interface AdminContentFilterState {
  userKey: string;
  /** Empty array means all plan labels. */
  planLabels: string[];
}

export const DEFAULT_ADMIN_CONTENT_FILTER: AdminContentFilterState = {
  userKey: ADMIN_FILTER_ALL,
  planLabels: [],
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
}

export function matchesAdminContentFilter<T extends Ownable>(
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
}: AdminContentFilterBarProps) {
  const active =
    filter.userKey !== ADMIN_FILTER_ALL || filter.planLabels.length > 0;

  if (users.length === 0 && plans.length === 0) return null;

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
            className="w-full sm:w-52"
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
            className="w-full sm:w-44"
            clearAfterSelect
            emptyText="موضوعی برای افزودن نیست"
          />
        )}

        {active && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => onChange(DEFAULT_ADMIN_CONTENT_FILTER)}
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
