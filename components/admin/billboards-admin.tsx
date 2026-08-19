"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ADMIN_FILTER_ALL,
  AdminContentFilterBar,
  adminContentFilterResetKey,
  buildAdminFilterSources,
  DEFAULT_ADMIN_CONTENT_FILTER,
  matchesAdminContentFilter,
  sortAdminContentItems,
  type AdminContentFilterState,
} from "@/components/admin/admin-content-filter-bar";
import {
  AdminBillboardAddCard,
  AdminBillboardCompactCard,
} from "@/components/admin/admin-billboard-compact-card";
import { BillboardCreateAssignmentDialog } from "@/components/admin/billboard-create-assignment-dialog";
import { AdminViewModeToggle } from "@/components/admin/admin-view-mode-toggle";
import { AdminItemActions } from "@/components/admin/admin-item-actions";
import { AdminPlanLabelsBadges } from "@/components/admin/admin-plan-labels-badges";
import { adminCreatedAtDetail } from "@/components/admin/admin-created-at";
import { AdminContentPreviewDialog } from "@/components/admin/admin-content-preview-dialog";
import {
  BulkItemShell,
  SectionBulkEditBar,
  useSectionBulkEdit,
} from "@/components/admin/section-bulk-edit";
import { deleteBillboardAction } from "@/lib/actions/admin-actions";
import { restoreBillboardCategoriesAction } from "@/lib/actions/billboard-category-restore-actions";
import {
  BILLBOARD_CATEGORIES,
  billboardCategoryLabels,
  buildBillboardCategoryStats,
  resolveBillboardCategoryLabel,
} from "@/lib/billboard-categories";
import { BillboardCategoryChart } from "@/components/charts/billboard-category-chart";
import { isApiBillboard } from "@/lib/billboards";
import { getBillboardCardImage, getBillboardDisplayImage } from "@/lib/billboard-media";
import type { ContentTopic } from "@/lib/content-topics";
import { type EditSuggestionMissingField } from "@/lib/edit-suggestions";
import { useAdminEditDeepLink } from "@/lib/hooks/use-admin-edit-deep-link";
import { useAdminViewMode } from "@/lib/hooks/use-admin-view-mode";
import { useSectionCreateGate } from "@/lib/hooks/use-section-create-gate";
import { useAdminInfiniteScroll } from "@/lib/hooks/use-admin-infinite-scroll";
import { AdminInfiniteScrollSentinel } from "@/components/admin/admin-infinite-scroll-sentinel";
import type { AdminUser, Billboard, CampaignScoringConfig } from "@/lib/types";
import { formatPersianDate, getStatusLabel } from "@/lib/utils";
import { formatBillboardCityLine } from "@/lib/billboard-location";
import { ScoringRulesProvider } from "@/lib/context/scoring-rules-context";

interface ContributorProfile {
  province?: string | null;
  city?: string | null;
  email: string;
  name: string;
}

interface BillboardsAdminProps {
  campaignId: string;
  initialBillboards: Billboard[];
  contentPlans?: string[];
  contentTopics?: ContentTopic[];
  scoringRules?: CampaignScoringConfig | null;
  canScore?: boolean;
  isFullAdmin?: boolean;
  canTransferOwnership?: boolean;
  users?: AdminUser[];
  contributorProfile?: ContributorProfile | null;
}

export function BillboardsAdmin({
  campaignId,
  initialBillboards,
  contentPlans = [],
  contentTopics = [],
  scoringRules = null,
  canScore = false,
  isFullAdmin = false,
  canTransferOwnership = false,
  users = [],
  contributorProfile = null,
}: BillboardsAdminProps) {
  const { requestCreate, tutorialModal } = useSectionCreateGate("billboards", campaignId);
  const router = useRouter();
  const [billboards, setBillboards] = useState(initialBillboards);
  const [formOpen, setFormOpen] = useState(false);
  const [editingBillboard, setEditingBillboard] = useState<Billboard | null>(null);
  const [previewBillboard, setPreviewBillboard] = useState<Billboard | null>(null);
  const [isRestoringCategories, setIsRestoringCategories] = useState(false);
  const [isLocalizingImages, setIsLocalizingImages] = useState(false);
  const [contentFilter, setContentFilter] = useState<AdminContentFilterState>(DEFAULT_ADMIN_CONTENT_FILTER);
  const [categoryFilter, setCategoryFilter] = useState(ADMIN_FILTER_ALL);
  const { viewMode, setViewMode } = useAdminViewMode("billboards");
  const [, startTransition] = useTransition();

  const billboardCategoryOptions = useMemo(
    () => BILLBOARD_CATEGORIES.map((key) => billboardCategoryLabels[key]),
    []
  );

  const { highlightFields, setHighlightFields, resetDeepLink } = useAdminEditDeepLink({
    items: billboards.filter((billboard) => !isApiBillboard(billboard)),
    getId: (billboard) => billboard.id,
    basePath: "/admin/billboards",
    onOpen: (billboard, fields) => {
      setEditingBillboard(billboard);
      setHighlightFields(fields);
      setFormOpen(true);
    },
  });

  useEffect(() => {
    setBillboards(initialBillboards);
  }, [initialBillboards]);

  const { users: filterUsers, locations: filterLocations } = useMemo(
    () => buildAdminFilterSources(billboards, users, canTransferOwnership || isFullAdmin),
    [billboards, users, canTransferOwnership, isFullAdmin]
  );
  const filteredBillboards = useMemo(() => {
    const filtered = billboards.filter((item) => {
      if (!matchesAdminContentFilter(item, contentFilter)) return false;
      if (categoryFilter === ADMIN_FILTER_ALL) return true;
      return resolveBillboardCategoryLabel(item) === categoryFilter;
    });
    return sortAdminContentItems(
      filtered,
      contentFilter.sortOrder,
      undefined,
      undefined,
      resolveBillboardCategoryLabel
    );
  }, [billboards, contentFilter, categoryFilter]);

  const categoryStats = useMemo(() => {
    const base = billboards.filter((item) => matchesAdminContentFilter(item, contentFilter));
    return buildBillboardCategoryStats(base);
  }, [billboards, contentFilter]);

  const manualBillboards = useMemo(
    () => filteredBillboards.filter((billboard) => !isApiBillboard(billboard)),
    [filteredBillboards]
  );
  const paginationResetKey = adminContentFilterResetKey(contentFilter, categoryFilter);
  const { visibleCount, hasMore, isLoadingMore, loadMore } = useAdminInfiniteScroll(
    manualBillboards.length,
    paginationResetKey
  );
  const visibleManualBillboards = useMemo(
    () => manualBillboards.slice(0, visibleCount),
    [manualBillboards, visibleCount]
  );
  const visibleIds = useMemo(
    () => visibleManualBillboards.map((item) => item.id),
    [visibleManualBillboards]
  );
  const filteredIds = useMemo(
    () => manualBillboards.map((item) => item.id),
    [manualBillboards]
  );
  const bulk = useSectionBulkEdit(visibleIds, filteredIds);

  const openCreate = () => {
    void requestCreate(() => {
      setEditingBillboard(null);
      setHighlightFields([]);
      setFormOpen(true);
    });
  };

  const openEdit = (billboard: Billboard, fields: EditSuggestionMissingField[] = []) => {
    if (isApiBillboard(billboard)) return;
    setEditingBillboard(billboard);
    setHighlightFields(fields);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingBillboard(null);
    resetDeepLink();
  };

  const handleDelete = (item: Billboard) => {
    if (isApiBillboard(item)) return;
    startTransition(async () => {
      await deleteBillboardAction(item.id);
      setBillboards((prev) => prev.filter((billboard) => billboard.id !== item.id));
      toast.success("حذف شد");
      router.refresh();
    });
  };

  const handleRestoreCategories = () => {
    if (!isFullAdmin || isRestoringCategories) return;
    const confirmed = window.confirm(
      "دسته‌بندی‌های خالی از بکاپ‌های ذخیره‌شده و برچسب‌های موجود بازیابی شوند؟"
    );
    if (!confirmed) return;

    setIsRestoringCategories(true);
    startTransition(async () => {
      try {
        const response = await restoreBillboardCategoriesAction(campaignId);
        if (!response.success || !response.result) {
          toast.error(response.error ?? "بازیابی ناموفق بود");
          return;
        }

        const { restoredFromBackup, restoredFromTags, stillMissing, backupsUsed } =
          response.result;
        const restored = restoredFromBackup + restoredFromTags;
        if (restored === 0) {
          toast.message(
            stillMissing > 0
              ? `بکاپ قابل‌استفاده‌ای پیدا نشد. هنوز ${stillMissing} مورد بدون دسته است.`
              : "موردی برای بازیابی پیدا نشد."
          );
        } else {
          toast.success(
            `${restored} دسته بازیابی شد` +
              (backupsUsed.length > 0 ? ` (از ${backupsUsed.length} بکاپ)` : "") +
              (stillMissing > 0 ? ` — ${stillMissing} مورد هنوز خالی است` : "")
          );
        }
        router.refresh();
      } finally {
        setIsRestoringCategories(false);
      }
    });
  };

  const handleLocalizeImages = () => {
    if (!isFullAdmin || isLocalizingImages) return;
    setIsLocalizingImages(true);
    startTransition(async () => {
      try {
        const res = await fetch("/api/billboard/localize-images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaignId }),
        });
        const result = await res.json();
        if (!res.ok || !result.success) {
          toast.error(result.error ?? "دانلود تصاویر ناموفق بود");
          return;
        }
        const { downloaded, failed, skipped } = result;
        if (downloaded === 0 && failed === 0) {
          toast.message("همه تصاویر قبلاً محلی هستند.");
        } else {
          toast.success(
            `${downloaded} تصویر دانلود شد` +
              (failed > 0 ? ` — ${failed} مورد ناموفق` : "") +
              (skipped > 0 ? ` — ${skipped} بدون تغییر` : "")
          );
        }
        router.refresh();
      } catch {
        toast.error("خطا در دانلود تصاویر");
      } finally {
        setIsLocalizingImages(false);
      }
    });
  };

  return (
    <ScoringRulesProvider scoringRules={scoringRules}>
    <div className="space-y-6">
      {tutorialModal}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">تبلیغات محیطی</h1>
          <p className="text-sm text-muted-foreground">
            بیلبورد، استرابورد، عرشه پل، تلویزیون شهری و سایر رسانه‌های محیطی
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isFullAdmin && (
            <Button
              type="button"
              variant="outline"
              disabled={isLocalizingImages}
              onClick={handleLocalizeImages}
            >
              {isLocalizingImages ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  در حال دانلود تصاویر...
                </>
              ) : (
                "دانلود تصاویر خارجی"
              )}
            </Button>
          )}
          {isFullAdmin && (
            <Button
              type="button"
              variant="outline"
              disabled={isRestoringCategories}
              onClick={handleRestoreCategories}
            >
              {isRestoringCategories ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  در حال بازیابی...
                </>
              ) : (
                "بازیابی دسته‌بندی‌ها"
              )}
            </Button>
          )}
          <AdminViewModeToggle value={viewMode} onChange={setViewMode} />
        </div>
      </div>

      <AdminContentFilterBar
        filter={contentFilter}
        onChange={setContentFilter}
        users={canTransferOwnership || isFullAdmin ? filterUsers : []}
        plans={contentPlans}
        locations={filterLocations}
        categoryOptions={billboardCategoryOptions}
        categoryValue={categoryFilter}
        onCategoryChange={setCategoryFilter}
        showCategorySort
      />

      {categoryStats.length > 0 && (
        <div className="mb-4">
          <BillboardCategoryChart
            data={categoryStats}
            selectedLabel={categoryFilter === ADMIN_FILTER_ALL ? null : categoryFilter}
            onSelect={(label) =>
              setCategoryFilter((prev) => (prev === label ? ADMIN_FILTER_ALL : label))
            }
          />
        </div>
      )}

      <SectionBulkEditBar
        campaignId={campaignId}
        contentType="billboard"
        bulkMode={bulk.bulkMode}
        onBulkModeChange={bulk.setBulkMode}
        selectedIds={[...bulk.selectedIds]}
        visibleCount={visibleManualBillboards.length}
        allVisibleSelected={bulk.allVisibleSelected}
        onToggleAllVisible={bulk.toggleAllVisible}
        onClearSelection={bulk.clearSelection}
        contentPlans={contentPlans}
        contentTopics={contentTopics}
        isFullAdmin={isFullAdmin}
        canTransferOwnership={canTransferOwnership || isFullAdmin}
        users={users}
      />

      <BillboardCreateAssignmentDialog
        open={formOpen}
        onOpenChange={(open) => (open ? setFormOpen(true) : closeForm())}
        campaignId={campaignId}
        contentPlans={contentPlans}
        contentTopics={contentTopics}
        canScore={canScore}
        canTransferOwnership={canTransferOwnership || isFullAdmin}
        users={users}
        mode={isFullAdmin ? "admin" : "client"}
        contributorProfile={contributorProfile}
        editingBillboard={editingBillboard}
        highlightFields={highlightFields}
        onCreated={() => router.refresh()}
      />

      {manualBillboards.length === 0 ? (
        <div className="rounded-xl border px-4 py-8 text-center text-sm text-muted-foreground">
          هنوز تبلیغات محیطی ثبت نشده است.
          {!bulk.bulkMode && (
            <div className="mt-3 flex justify-center">
              <div className="w-full max-w-[10rem]">
                <AdminBillboardAddCard onClick={openCreate} />
              </div>
            </div>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {!bulk.bulkMode && <AdminBillboardAddCard onClick={openCreate} />}
          {visibleManualBillboards.map((billboard) => (
            <BulkItemShell
              key={billboard.id}
              enabled={bulk.bulkMode}
              selected={bulk.isSelected(billboard.id)}
              onToggle={() => bulk.toggle(billboard.id)}
            >
              <AdminBillboardCompactCard
                billboard={billboard}
                onClick={() => (bulk.bulkMode ? setPreviewBillboard(billboard) : openEdit(billboard))}
                onView={() => setPreviewBillboard(billboard)}
                onEdit={() => openEdit(billboard)}
                onDelete={handleDelete}
                canScore={canScore}
                onScoreSaved={(item, score) => {
                  setBillboards((prev) =>
                    prev.map((row) => (row.id === item.id ? { ...row, score } : row))
                  );
                }}
              />
            </BulkItemShell>
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          {visibleManualBillboards.map((billboard) => (
            <div
              key={billboard.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 last:border-b-0"
            >
              <div className="flex min-w-0 items-start gap-3">
                {bulk.bulkMode && (
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    checked={bulk.isSelected(billboard.id)}
                    onChange={() => bulk.toggle(billboard.id)}
                  />
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium">{billboard.title}</p>
                    <Badge variant="outline" className="text-[10px]">
                      {resolveBillboardCategoryLabel(billboard)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{formatBillboardCityLine(billboard)}</p>
                  <AdminPlanLabelsBadges
                    planLabels={billboard.planLabels}
                    planLabel={billboard.planLabel}
                    className="mt-1"
                  />
                </div>
              </div>
                <AdminItemActions
                  onView={() => setPreviewBillboard(billboard)}
                  onEdit={() => openEdit(billboard)}
                  onDelete={() => handleDelete(billboard)}
                />
            </div>
          ))}
        </div>
      )}

      <AdminInfiniteScrollSentinel
        hasMore={hasMore}
        isLoadingMore={isLoadingMore}
        onLoadMore={loadMore}
        remaining={manualBillboards.length - visibleCount}
      />

      <AdminContentPreviewDialog
        open={Boolean(previewBillboard)}
        onOpenChange={(open) => !open && setPreviewBillboard(null)}
        title={previewBillboard?.title ?? "نمایش تبلیغات محیطی"}
        description={previewBillboard?.description}
        imageUrl={previewBillboard ? getBillboardDisplayImage(previewBillboard) : null}
        previewImageUrl={previewBillboard ? getBillboardCardImage(previewBillboard) : null}
        meta={
          previewBillboard ? (
            <div className="space-y-1">
              <Badge variant="outline" className="text-[10px]">
                {resolveBillboardCategoryLabel(previewBillboard)}
              </Badge>
              <p className="text-xs text-muted-foreground">{formatBillboardCityLine(previewBillboard)}</p>
            </div>
          ) : null
        }
        details={
          previewBillboard
            ? [
                { label: "تاریخ", value: formatPersianDate(previewBillboard.date) },
                adminCreatedAtDetail(previewBillboard.createdAt),
                { label: "وضعیت", value: getStatusLabel(previewBillboard.status) },
                { label: "کد", value: previewBillboard.code || "—" },
                { label: "مالک", value: previewBillboard.ownerName ?? "—" },
                {
                  label: "برچسب‌ها",
                  value: previewBillboard.planLabels?.length ? previewBillboard.planLabels.join("، ") : "—",
                },
                { label: "یادداشت", value: previewBillboard.notes || "—" },
              ]
            : []
        }
        onEdit={
          previewBillboard
            ? () => {
                setPreviewBillboard(null);
                openEdit(previewBillboard);
              }
            : undefined
        }
        canSendMessage={canTransferOwnership || isFullAdmin}
        messageTarget={
          previewBillboard
            ? {
                campaignId,
                contentType: "billboard",
                contentId: previewBillboard.id,
                contentTitle: previewBillboard.title,
                ownerName: previewBillboard.ownerName,
              }
            : null
        }
      />
    </div>
    </ScoringRulesProvider>
  );
}
