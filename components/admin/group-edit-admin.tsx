"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Layers, Search } from "lucide-react";
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
import { formatPlanLabelDisplay, normalizePlanLabels, type ContentTopic } from "@/lib/content-topics";
import { hasContributorPermission, type ContributorPermissions } from "@/lib/contributor-permissions";
import { splitPressActivities } from "@/lib/press-publications";
import { splitSocialPosts } from "@/lib/social-posts";
import type {
  ActivityType,
  Billboard,
  CampaignActivity,
  CampaignFile,
  ItemStatus,
  MediaCategory,
  Ownable,
  Poster,
  RawMediaUpload,
  SocialMediaPost,
  Video,
} from "@/lib/types";
import { formatPersianNumber, getStatusLabel } from "@/lib/utils";

interface GroupEditRow extends Ownable {
  id: string;
  title: string;
  published?: boolean;
  subtitle?: string;
  categoryId?: string;
  category?: string | null;
  status?: ItemStatus;
  activityType?: ActivityType;
}

interface GroupEditAdminProps {
  campaignId: string;
  isFullAdmin: boolean;
  permissions: ContributorPermissions | null;
  contentPlans: string[];
  contentTopics: ContentTopic[];
  billboards: Billboard[];
  posters: Poster[];
  posterCategories: MediaCategory[];
  videos: Video[];
  videoCategories: MediaCategory[];
  files: CampaignFile[];
  rawMedia: RawMediaUpload[];
  socialPosts: SocialMediaPost[];
  activities: CampaignActivity[];
}

const TYPE_OPTIONS: {
  type: BulkEditableContentType;
  label: string;
  permissionKey:
    | "billboards"
    | "posters"
    | "videos"
    | "files"
    | "rawMedia"
    | "socialPosts"
    | "sitePublications"
    | "activities";
}[] = [
  { type: "billboard", label: "تبلیغات محیطی", permissionKey: "billboards" },
  { type: "poster", label: "پوسترها", permissionKey: "posters" },
  { type: "video", label: "ویدیوها", permissionKey: "videos" },
  { type: "file", label: "فایل‌ها", permissionKey: "files" },
  { type: "raw_media", label: "راش تصویر", permissionKey: "rawMedia" },
  { type: "social_post", label: "شبکه‌های اجتماعی", permissionKey: "socialPosts" },
  { type: "site_publication", label: "انتشار سایت", permissionKey: "sitePublications" },
  { type: "activity", label: "اقدامات", permissionKey: "activities" },
  { type: "press", label: "مجله و روزنامه", permissionKey: "activities" },
];

const BILLBOARD_STATUSES: ItemStatus[] = ["draft", "published", "pending", "approved", "rejected"];

function toRows(
  contentType: BulkEditableContentType,
  props: GroupEditAdminProps
): GroupEditRow[] {
  switch (contentType) {
    case "billboard":
      return props.billboards.map((item) => ({
        ...item,
        subtitle: [item.city, getBillboardCategoryLabel(item.category)].filter(Boolean).join(" — "),
      }));
    case "poster": {
      const byId = new Map(props.posterCategories.map((c) => [c.id, c.title]));
      return props.posters.map((item) => ({
        ...item,
        subtitle: byId.get(item.categoryId),
      }));
    }
    case "video": {
      const byId = new Map(props.videoCategories.map((c) => [c.id, c.title]));
      return props.videos.map((item) => ({
        ...item,
        subtitle: byId.get(item.categoryId),
      }));
    }
    case "file":
      return props.files.map((item) => ({ ...item, subtitle: item.fileName }));
    case "raw_media":
      return props.rawMedia.map((item) => ({ ...item, subtitle: item.mediaKind }));
    case "social_post":
      return splitSocialPosts(props.socialPosts).socialPosts.map((item) => ({
        ...item,
        subtitle: getStatusLabel(item.platform),
      }));
    case "site_publication":
      return splitSocialPosts(props.socialPosts).sitePublications.map((item) => ({
        ...item,
        subtitle: item.publishedDate,
      }));
    case "activity":
      return splitPressActivities(props.activities).fieldActivities.map((item) => ({
        ...item,
        subtitle: activityTypeLabels[item.activityType],
      }));
    case "press":
      return splitPressActivities(props.activities).pressPublications.map((item) => ({
        ...item,
        subtitle: activityTypeLabels[item.activityType],
      }));
    default:
      return [];
  }
}

export function GroupEditAdmin(props: GroupEditAdminProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const allowedTypes = useMemo(
    () =>
      TYPE_OPTIONS.filter(
        (option) =>
          props.isFullAdmin || hasContributorPermission(props.permissions, option.permissionKey)
      ),
    [props.isFullAdmin, props.permissions]
  );

  const [contentType, setContentType] = useState<BulkEditableContentType>(
    allowedTypes[0]?.type ?? "billboard"
  );
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [changeTopic, setChangeTopic] = useState(false);
  const [planLabels, setPlanLabels] = useState<string[]>([]);
  const [publishedMode, setPublishedMode] = useState<"unchanged" | "true" | "false">("unchanged");
  const [billboardCategory, setBillboardCategory] = useState<string>("unchanged");
  const [billboardStatus, setBillboardStatus] = useState<string>("unchanged");
  const [mediaCategoryId, setMediaCategoryId] = useState<string>("unchanged");
  const [activityType, setActivityType] = useState<string>("unchanged");

  useEffect(() => {
    if (!allowedTypes.some((option) => option.type === contentType) && allowedTypes[0]) {
      setContentType(allowedTypes[0].type);
    }
  }, [allowedTypes, contentType]);

  useEffect(() => {
    setSelectedIds(new Set());
    setSearch("");
    setChangeTopic(false);
    setPlanLabels([]);
    setPublishedMode("unchanged");
    setBillboardCategory("unchanged");
    setBillboardStatus("unchanged");
    setMediaCategoryId("unchanged");
    setActivityType("unchanged");
  }, [contentType]);

  const rows = useMemo(() => toRows(contentType, props), [contentType, props]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const labels = normalizePlanLabels(row.planLabels, row.planLabel).join(" ");
      return (
        row.title.toLowerCase().includes(q) ||
        (row.subtitle ?? "").toLowerCase().includes(q) ||
        labels.toLowerCase().includes(q) ||
        (row.ownerName ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search]);

  const allVisibleSelected =
    filteredRows.length > 0 && filteredRows.every((row) => selectedIds.has(row.id));

  const mediaCategories =
    contentType === "poster"
      ? props.posterCategories
      : contentType === "video"
        ? props.videoCategories
        : [];

  const activityOptions =
    contentType === "press" ? pressActivityTypeOptions : fieldActivityTypeOptions;

  const toggleRow = (id: string) => {
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
        filteredRows.forEach((row) => next.delete(row.id));
        return next;
      });
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredRows.forEach((row) => next.add(row.id));
      return next;
    });
  };

  const buildPatch = (): BulkContentPatch | null => {
    const patch: BulkContentPatch = {};
    if (changeTopic) patch.planLabels = planLabels;
    if (publishedMode === "true") patch.published = true;
    if (publishedMode === "false") patch.published = false;

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

    if (
      (contentType === "activity" || contentType === "press") &&
      activityType !== "unchanged"
    ) {
      patch.activityType = activityType as ActivityType;
    }

    if (
      patch.planLabels === undefined &&
      patch.published === undefined &&
      patch.category === undefined &&
      patch.status === undefined &&
      patch.categoryId === undefined &&
      patch.activityType === undefined
    ) {
      return null;
    }

    return patch;
  };

  const applyLocalPatch = (items: GroupEditRow[], patch: BulkContentPatch): GroupEditRow[] => {
    const idSet = selectedIds;
    return items.map((item) => {
      if (!idSet.has(item.id)) return item;
      const next = { ...item };
      if (patch.planLabels !== undefined) {
        next.planLabels = patch.planLabels;
        next.planLabel = patch.planLabels[0] ?? null;
      }
      if (patch.published !== undefined) next.published = patch.published;
      if (patch.category !== undefined) next.category = patch.category;
      if (patch.status !== undefined) next.status = patch.status;
      if (patch.categoryId !== undefined) next.categoryId = patch.categoryId;
      if (patch.activityType !== undefined) {
        next.activityType = patch.activityType;
        next.subtitle = activityTypeLabels[patch.activityType];
      }
      return next;
    });
  };

  // Optimistic local state mirrors are avoided; we refresh from server after save.
  // Keep a local override map for immediate UI feedback after apply.
  const [localOverrides, setLocalOverrides] = useState<Record<string, GroupEditRow>>({});

  useEffect(() => {
    setLocalOverrides({});
  }, [contentType, props]);

  const displayRows = useMemo(
    () => filteredRows.map((row) => localOverrides[row.id] ?? row),
    [filteredRows, localOverrides]
  );

  const handleApply = () => {
    const patch = buildPatch();
    if (!patch) {
      toast.error("حداقل یک فیلد برای تغییر انتخاب کنید");
      return;
    }
    if (selectedIds.size === 0) {
      toast.error("حداقل یک مورد را انتخاب کنید");
      return;
    }

    startTransition(async () => {
      const result = await bulkUpdateContentAction({
        campaignId: props.campaignId,
        contentType,
        ids: [...selectedIds],
        patch,
      });

      if (!result.success) {
        toast.error(result.error ?? "خطا در ذخیره");
        return;
      }

      setLocalOverrides((prev) => {
        const next = { ...prev };
        for (const row of applyLocalPatch(rows, patch)) {
          if (selectedIds.has(row.id)) next[row.id] = row;
        }
        return next;
      });

      toast.success(`${formatPersianNumber(result.updated)} مورد به‌روزرسانی شد`);
      router.refresh();
    });
  };

  if (allowedTypes.length === 0) {
    return (
      <div className="rounded-xl border py-12 text-center text-muted-foreground">
        دسترسی به هیچ بخش محتوایی برای ویرایش گروهی ندارید.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Layers className="h-6 w-6" />
          ویرایش گروهی
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          چند محتوا را انتخاب کنید و موضوع یا فیلدهای مشترک همان بخش را یک‌جا تغییر دهید.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {allowedTypes.map((option) => (
          <Button
            key={option.type}
            type="button"
            size="sm"
            variant={contentType === option.type ? "default" : "outline"}
            onClick={() => setContentType(option.type)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[200px] max-w-sm flex-1">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="جستجو در عنوان، موضوع، مالک..."
                className="pr-9"
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={allVisibleSelected}
                onChange={toggleAllVisible}
                disabled={filteredRows.length === 0}
              />
              انتخاب همه ({formatPersianNumber(filteredRows.length)})
            </label>
            {selectedIds.size > 0 && (
              <Badge variant="secondary">{formatPersianNumber(selectedIds.size)} انتخاب‌شده</Badge>
            )}
          </div>

          {displayRows.length === 0 ? (
            <div className="rounded-xl border py-12 text-center text-sm text-muted-foreground">
              موردی در این بخش نیست.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border">
              <ul className="divide-y">
                {displayRows.map((row) => {
                  const labels = normalizePlanLabels(row.planLabels, row.planLabel);
                  return (
                    <li key={row.id}>
                      <label className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-muted/30">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4"
                          checked={selectedIds.has(row.id)}
                          onChange={() => toggleRow(row.id)}
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-medium">{row.title}</p>
                            {row.published != null && (
                              <Badge variant={row.published ? "secondary" : "outline"} className="text-[10px]">
                                {row.published ? "منتشر" : "پیش‌نویس"}
                              </Badge>
                            )}
                          </div>
                          {row.subtitle && (
                            <p className="truncate text-xs text-muted-foreground">{row.subtitle}</p>
                          )}
                          {row.ownerName && (
                            <p className="truncate text-[11px] text-muted-foreground">{row.ownerName}</p>
                          )}
                          <div className="flex flex-wrap gap-1">
                            {labels.length > 0 ? (
                              labels.map((token) => (
                                <Badge key={token} variant="outline" className="text-[10px]">
                                  {formatPlanLabelDisplay(token)}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-[11px] text-muted-foreground">بدون موضوع</span>
                            )}
                          </div>
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <aside className="space-y-4 rounded-xl border bg-card p-4 lg:sticky lg:top-4 lg:self-start">
          <div>
            <h2 className="text-sm font-semibold">اعمال روی انتخاب‌شده‌ها</h2>
            <p className="text-xs text-muted-foreground">
              فقط فیلدهایی که فعال می‌کنید عوض می‌شوند.
            </p>
          </div>

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
                topics={props.contentTopics}
                plans={props.contentPlans}
                values={planLabels}
                onChangeMultiple={setPlanLabels}
                label="موضوع جدید"
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label>وضعیت انتشار</Label>
            <Select
              value={publishedMode}
              onValueChange={(value: "unchanged" | "true" | "false") => setPublishedMode(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unchanged">بدون تغییر</SelectItem>
                <SelectItem value="true">منتشر شده</SelectItem>
                <SelectItem value="false">پیش‌نویس</SelectItem>
              </SelectContent>
            </Select>
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
                    <SelectItem value="clear">پاک کردن دسته</SelectItem>
                    {BILLBOARD_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {getBillboardCategoryLabel(category)}
                      </SelectItem>
                    ))}
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

          <Button
            type="button"
            className="w-full"
            disabled={isPending || selectedIds.size === 0}
            onClick={handleApply}
          >
            {isPending
              ? "در حال اعمال..."
              : `اعمال روی ${formatPersianNumber(selectedIds.size)} مورد`}
          </Button>
        </aside>
      </div>
    </div>
  );
}
