"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CheckSquare, Layers, Square, X } from "lucide-react";
import { toast } from "sonner";
import { PlanLabelSelect } from "@/components/admin/plan-label-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  bulkUpdateContentAction,
  type BulkContentPatch,
  type BulkEditableContentType,
} from "@/lib/actions/bulk-update-actions";
import {
  activityTypeLabels,
  fieldActivityTypeOptions,
  pressActivityTypeOptions,
} from "@/lib/activity-types";
import {
  BILLBOARD_CATEGORIES,
  getBillboardCategoryLabel,
} from "@/lib/billboard-categories";
import type { ContentTopic } from "@/lib/content-topics";
import type { ActivityType, AdminUser, ItemStatus, MediaCategory } from "@/lib/types";
import { cn, formatPersianNumber, getStatusLabel } from "@/lib/utils";

const BILLBOARD_STATUSES: ItemStatus[] = ["pending", "approved", "rejected", "completed"];

export function useSectionBulkEdit(visibleIds: string[]) {
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const visible = new Set(visibleIds);
    setSelectedIds((prev) => {
      const next = new Set([...prev].filter((id) => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [visibleIds]);

  useEffect(() => {
    if (!bulkMode) setSelectedIds(new Set());
  }, [bulkMode]);

  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      });
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      visibleIds.forEach((id) => next.add(id));
      return next;
    });
  };

  return {
    bulkMode,
    setBulkMode,
    selectedIds,
    selectedCount: selectedIds.size,
    allVisibleSelected,
    toggle,
    toggleAllVisible,
    clearSelection: () => setSelectedIds(new Set()),
    isSelected: (id: string) => selectedIds.has(id),
  };
}

interface BulkItemShellProps {
  enabled: boolean;
  selected: boolean;
  onToggle: () => void;
  children: ReactNode;
  className?: string;
}

export function BulkItemShell({
  enabled,
  selected,
  onToggle,
  children,
  className,
}: BulkItemShellProps) {
  if (!enabled) return <>{children}</>;

  return (
    <div className={cn("relative", className)}>
      <div
        className={cn(
          "rounded-xl transition-shadow",
          selected && "ring-2 ring-primary ring-offset-2 ring-offset-background"
        )}
      >
        <div className="pointer-events-none">{children}</div>
      </div>
      <button
        type="button"
        aria-label="انتخاب برای ویرایش گروهی"
        onClick={onToggle}
        className="absolute inset-0 z-20 rounded-xl"
      />
      <span
        className={cn(
          "pointer-events-none absolute top-2 right-2 z-30 flex h-6 w-6 items-center justify-center rounded-md border bg-background/95 shadow-sm",
          selected ? "border-primary text-primary" : "border-muted-foreground/40 text-muted-foreground"
        )}
      >
        {selected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
      </span>
    </div>
  );
}

interface SectionBulkEditBarProps {
  campaignId: string;
  contentType: BulkEditableContentType;
  bulkMode: boolean;
  onBulkModeChange: (value: boolean) => void;
  selectedIds: string[];
  visibleCount: number;
  allVisibleSelected: boolean;
  onToggleAllVisible: () => void;
  onClearSelection: () => void;
  contentPlans?: string[];
  contentTopics?: ContentTopic[];
  mediaCategories?: MediaCategory[];
  isFullAdmin?: boolean;
  users?: AdminUser[];
  onApplied?: () => void;
}

export function SectionBulkEditBar({
  campaignId,
  contentType,
  bulkMode,
  onBulkModeChange,
  selectedIds,
  visibleCount,
  allVisibleSelected,
  onToggleAllVisible,
  onClearSelection,
  contentPlans = [],
  contentTopics = [],
  mediaCategories = [],
  isFullAdmin = false,
  users = [],
  onApplied,
}: SectionBulkEditBarProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [panelOpen, setPanelOpen] = useState(false);

  const [changeTopic, setChangeTopic] = useState(false);
  const [planLabels, setPlanLabels] = useState<string[]>([]);
  const [billboardCategory, setBillboardCategory] = useState("unchanged");
  const [billboardStatus, setBillboardStatus] = useState("unchanged");
  const [mediaCategoryId, setMediaCategoryId] = useState("unchanged");
  const [activityType, setActivityType] = useState("unchanged");
  const [ownerMode, setOwnerMode] = useState("unchanged");
  const [ownerSearch, setOwnerSearch] = useState("");

  useEffect(() => {
    if (!bulkMode) {
      setPanelOpen(false);
      setChangeTopic(false);
      setPlanLabels([]);
      setBillboardCategory("unchanged");
      setBillboardStatus("unchanged");
      setMediaCategoryId("unchanged");
      setActivityType("unchanged");
      setOwnerMode("unchanged");
      setOwnerSearch("");
    }
  }, [bulkMode]);

  useEffect(() => {
    if (selectedIds.length > 0) setPanelOpen(true);
  }, [selectedIds.length]);

  const activityOptions =
    contentType === "press" ? pressActivityTypeOptions : fieldActivityTypeOptions;

  const transferableUsers = useMemo(() => {
    const q = ownerSearch.trim().toLowerCase();
    const sorted = [...users].sort((a, b) => a.name.localeCompare(b.name, "fa"));
    if (!q) return sorted;
    return sorted.filter(
      (user) =>
        user.name.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q) ||
        (user.province ?? "").toLowerCase().includes(q)
    );
  }, [ownerSearch, users]);

  const selectedOwner = useMemo(
    () => users.find((user) => user.id === ownerMode) ?? null,
    [ownerMode, users]
  );

  const buildPatch = (): BulkContentPatch | null => {
    const patch: BulkContentPatch = {};
    if (changeTopic) patch.planLabels = planLabels;

    if (contentType === "billboard") {
      if (billboardCategory !== "unchanged") {
        patch.category = billboardCategory === "clear" ? null : billboardCategory;
      }
      if (billboardStatus !== "unchanged") {
        patch.status = billboardStatus as ItemStatus;
      }
    }

    if ((contentType === "poster" || contentType === "video") && mediaCategoryId !== "unchanged") {
      patch.categoryId = mediaCategoryId;
    }

    if ((contentType === "activity" || contentType === "press") && activityType !== "unchanged") {
      patch.activityType = activityType as ActivityType;
    }

    if (isFullAdmin && ownerMode !== "unchanged") {
      patch.ownerUserId = ownerMode === "clear" ? null : ownerMode;
    }

    if (
      patch.planLabels === undefined &&
      patch.category === undefined &&
      patch.status === undefined &&
      patch.categoryId === undefined &&
      patch.activityType === undefined &&
      patch.ownerUserId === undefined
    ) {
      return null;
    }

    return patch;
  };

  const handleApply = () => {
    const patch = buildPatch();
    if (!patch) {
      toast.error("حداقل یک فیلد برای تغییر انتخاب کنید");
      return;
    }
    if (selectedIds.length === 0) {
      toast.error("حداقل یک مورد را انتخاب کنید");
      return;
    }

    if (contentType === "billboard" && patch.category === null) {
      const confirmed = window.confirm(
        `دسته ${formatPersianNumber(selectedIds.length)} مورد پاک شود؟ این کار قابل برگشت آسان نیست.`
      );
      if (!confirmed) return;
    }

    startTransition(async () => {
      const result = await bulkUpdateContentAction({
        campaignId,
        contentType,
        ids: selectedIds,
        patch,
      });
      if (!result.success) {
        toast.error(result.error ?? "خطا در ذخیره");
        return;
      }
      toast.success(`${formatPersianNumber(result.updated)} مورد به‌روزرسانی شد`);
      onClearSelection();
      setPanelOpen(false);
      onApplied?.();
      router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant={bulkMode ? "default" : "outline"}
          onClick={() => onBulkModeChange(!bulkMode)}
        >
          <Layers className="h-4 w-4" />
          ویرایش گروهی
        </Button>

        {bulkMode && (
          <>
            <Button type="button" size="sm" variant="outline" onClick={onToggleAllVisible}>
              {allVisibleSelected ? "لغو انتخاب همه" : `انتخاب همه (${formatPersianNumber(visibleCount)})`}
            </Button>
            {selectedIds.length > 0 && (
              <Badge variant="secondary">{formatPersianNumber(selectedIds.length)} انتخاب‌شده</Badge>
            )}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                onBulkModeChange(false);
                onClearSelection();
              }}
            >
              <X className="h-4 w-4" />
              خروج
            </Button>
          </>
        )}
      </div>

      {bulkMode && panelOpen && selectedIds.length > 0 && (
        <div className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">اعمال روی انتخاب‌شده‌ها</p>
              <p className="text-xs text-muted-foreground">فقط فیلدهایی که فعال می‌کنید عوض می‌شوند.</p>
            </div>
            <Button type="button" size="icon" variant="ghost" onClick={() => setPanelOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={changeTopic}
                  onChange={(event) => setChangeTopic(event.target.checked)}
                />
                تغییر موضوع
              </label>
              {changeTopic && (
                <PlanLabelSelect
                  topics={contentTopics}
                  plans={contentPlans}
                  values={planLabels}
                  onChangeMultiple={setPlanLabels}
                  label="موضوع جدید"
                />
              )}
            </div>

            {contentType === "billboard" && (
              <>
                <div className="space-y-1.5">
                  <Label>دسته تبلیغات محیطی</Label>
                  <Select value={billboardCategory} onValueChange={setBillboardCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unchanged">بدون تغییر</SelectItem>
                      {BILLBOARD_CATEGORIES.map((category) => (
                        <SelectItem key={category} value={category}>
                          {getBillboardCategoryLabel(category)}
                        </SelectItem>
                      ))}
                      <SelectItem value="clear" className="text-destructive focus:text-destructive">
                        پاک کردن دسته
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>وضعیت بیلبورد</Label>
                  <Select value={billboardStatus} onValueChange={setBillboardStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unchanged">بدون تغییر</SelectItem>
                      {BILLBOARD_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {getStatusLabel(status)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {(contentType === "poster" || contentType === "video") && (
              <div className="space-y-1.5">
                <Label>{contentType === "poster" ? "دسته پوستر" : "نوع ویدیو"}</Label>
                <Select value={mediaCategoryId} onValueChange={setMediaCategoryId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unchanged">بدون تغییر</SelectItem>
                    {mediaCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(contentType === "activity" || contentType === "press") && (
              <div className="space-y-1.5">
                <Label>نوع {contentType === "press" ? "رسانه" : "اقدام"}</Label>
                <Select value={activityType} onValueChange={setActivityType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unchanged">بدون تغییر</SelectItem>
                    {activityOptions.map((type) => (
                      <SelectItem key={type} value={type}>
                        {activityTypeLabels[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {isFullAdmin && (
            <div className="space-y-2 rounded-lg border border-dashed p-3">
              <Label>انتقال مالکیت</Label>
              <div className="flex flex-wrap gap-2">
                <Select value={ownerMode} onValueChange={setOwnerMode}>
                  <SelectTrigger className="w-full sm:w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unchanged">بدون تغییر</SelectItem>
                    <SelectItem value="clear">حذف مالک</SelectItem>
                    {selectedOwner && (
                      <SelectItem value={selectedOwner.id}>
                        {selectedOwner.name} — {selectedOwner.email}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <Input
                  value={ownerSearch}
                  onChange={(event) => setOwnerSearch(event.target.value)}
                  placeholder="جستجوی کاربر..."
                  className="h-9 max-w-xs text-xs"
                />
              </div>
              <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border p-1">
                {transferableUsers.slice(0, 30).map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => setOwnerMode(user.id)}
                    className={cn(
                      "w-full rounded-md px-2 py-1.5 text-right text-xs",
                      ownerMode === user.id
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    <span className="block font-medium">{user.name}</span>
                    <span className="block text-[10px] opacity-80">{user.email}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <Button type="button" disabled={isPending} onClick={handleApply}>
            {isPending
              ? "در حال اعمال..."
              : `اعمال روی ${formatPersianNumber(selectedIds.length)} مورد`}
          </Button>
        </div>
      )}
    </div>
  );
}
