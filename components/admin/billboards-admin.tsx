"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ADMIN_FILTER_ALL,
  AdminContentFilterBar,
  collectAdminFilterUsers,
  DEFAULT_ADMIN_CONTENT_FILTER,
  matchesAdminContentFilter,
  sortAdminContentItems,
  type AdminContentFilterState,
} from "@/components/admin/admin-content-filter-bar";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { adminOwnerTableColumn } from "@/components/admin/admin-owner-badge";
import {
  AdminBillboardAddCard,
  AdminBillboardCompactCard,
} from "@/components/admin/admin-billboard-compact-card";
import { MapBilboardBackupImportPanel } from "@/components/admin/map-bilboard-backup-import-panel";
import { BillboardIntegrationImportPanel } from "@/components/admin/billboard-integration-import-panel";
import { BillboardCreateAssignmentDialog } from "@/components/admin/billboard-create-assignment-dialog";
import { BillboardAddPeriodDialog } from "@/components/admin/billboard-add-period-dialog";
import { AdminViewModeToggle } from "@/components/admin/admin-view-mode-toggle";
import { AdminItemActions } from "@/components/admin/admin-item-actions";
import { AdminPlanLabelsBadges } from "@/components/admin/admin-plan-labels-badges";
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
  resolveBillboardCategoryDisplay,
  resolveBillboardCategoryLabel,
} from "@/lib/billboard-categories";
import { BillboardCategoryChart } from "@/components/charts/billboard-category-chart";
import { canManageBillboardPeriods, isApiBillboard } from "@/lib/billboards";
import { getBillboardDisplayImage } from "@/lib/billboard-media";
import type { ContentTopic } from "@/lib/content-topics";
import { type EditSuggestionMissingField } from "@/lib/edit-suggestions";
import { useAdminEditDeepLink } from "@/lib/hooks/use-admin-edit-deep-link";
import { useAdminViewMode } from "@/lib/hooks/use-admin-view-mode";
import { useSectionCreateGate } from "@/lib/hooks/use-section-create-gate";
import { useAdminInfiniteScroll } from "@/lib/hooks/use-admin-infinite-scroll";
import { AdminInfiniteScrollSentinel } from "@/components/admin/admin-infinite-scroll-sentinel";
import type { AdminUser, Billboard } from "@/lib/types";
import { formatPersianDate, getStatusLabel } from "@/lib/utils";
import { formatBillboardCityLine } from "@/lib/billboard-location";

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
  canScore?: boolean;
  liveApiEnabled?: boolean;
  externalCampaignSlug?: string | null;
  externalCampaignId?: string | null;
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
  canScore = false,
  liveApiEnabled = false,
  externalCampaignSlug = null,
  externalCampaignId = null,
  isFullAdmin = false,
  canTransferOwnership = false,
  users = [],
  contributorProfile = null,
}: BillboardsAdminProps) {
  const { requestCreate, tutorialModal } = useSectionCreateGate("billboards");
  const router = useRouter();
  const [billboards, setBillboards] = useState(initialBillboards);
  const [formOpen, setFormOpen] = useState(false);
  const [editingBillboard, setEditingBillboard] = useState<Billboard | null>(null);
  const [previewBillboard, setPreviewBillboard] = useState<Billboard | null>(null);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [periodBillboard, setPeriodBillboard] = useState<Billboard | null>(null);
  const [isNormalizing, setIsNormalizing] = useState(false);
  const [isRestoringCategories, setIsRestoringCategories] = useState(false);
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

  const filterUsers = useMemo(() => collectAdminFilterUsers(billboards), [billboards]);
  const filteredBillboards = useMemo(() => {
    const filtered = billboards.filter((item) => {
      if (!matchesAdminContentFilter(item, contentFilter)) return false;
      if (categoryFilter === ADMIN_FILTER_ALL) return true;
      return resolveBillboardCategoryDisplay(item) === categoryFilter;
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

  const handleNormalizeApiBillboards = () => {
    void (async () => {
      setIsNormalizing(true);
      try {
        const response = await fetch("/api/billboard/normalize-locations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ campaignId }),
        });
        const result = await response.json();
        if (!response.ok) {
          toast.error(result.error ?? "اصلاح استان/شهر ناموفق بود");
          return;
        }
        toast.success(`اصلاح انجام شد: ${result.updated} بیلبورد`);
        router.refresh();
      } catch {
        toast.error("اصلاح استان/شهر با خطا مواجه شد");
      } finally {
        setIsNormalizing(false);
      }
    })();
  };

  const manualBillboards = useMemo(
    () => filteredBillboards.filter((billboard) => !isApiBillboard(billboard)),
    [filteredBillboards]
  );
  const apiBillboards = filteredBillboards.filter((billboard) => isApiBillboard(billboard));
  const allApiBillboards = billboards.filter((billboard) => isApiBillboard(billboard));
  const paginationResetKey = `${contentFilter.userKey}:${contentFilter.planLabels.join(",")}:${contentFilter.sortOrder}:${categoryFilter}:${viewMode}`;
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
  const bulk = useSectionBulkEdit(visibleIds);
  const showExternalMigrationTools = isFullAdmin && liveApiEnabled && Boolean(externalCampaignSlug);
  const showExternalPeriodTools = showExternalMigrationTools && Boolean(externalCampaignId);

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

  return (
    <div className="space-y-6">
      {tutorialModal}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">تبلیغات محیطی</h1>
          <p className="text-sm text-muted-foreground">
            بیلبورد، استرابورد، عرشه پل، تلویزیون شهری و سایر رسانه‌های محیطی
            {allApiBillboards.length > 0
              ? ` — ${allApiBillboards.length} مورد قدیمی از Map-Bilboard فقط برای مشاهده است.`
              : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
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
        categoryOptions={billboardCategoryOptions}
        categoryValue={categoryFilter}
        onCategoryChange={setCategoryFilter}
        showCategorySort
      />

      {categoryStats.length > 0 && (
        <div className="mb-4">
          <BillboardCategoryChart data={categoryStats} />
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

      {showExternalMigrationTools && (
        <>
          <BillboardIntegrationImportPanel
            campaignId={campaignId}
            externalCampaignSlug={externalCampaignSlug}
            onImported={() => router.refresh()}
          />
          <MapBilboardBackupImportPanel
            campaignId={campaignId}
            externalCampaignSlug={externalCampaignSlug}
            onImported={() => router.refresh()}
          />
          <div className="flex justify-end">
            <Button
              type="button"
              variant="secondary"
              disabled={isNormalizing}
              onClick={handleNormalizeApiBillboards}
              className="mt-3"
            >
              {isNormalizing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  در حال اصلاح...
                </>
              ) : (
                <>
                  <Wrench className="h-4 w-4" />
                  اصلاح استان/شهر بیلبوردهای API
                </>
              )}
            </Button>
          </div>
        </>
      )}

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

      {showExternalPeriodTools && externalCampaignId && (
        <BillboardAddPeriodDialog
          open={periodOpen}
          onOpenChange={setPeriodOpen}
          campaignId={campaignId}
          externalCampaignId={externalCampaignId}
          billboard={periodBillboard}
          onAdded={() => router.refresh()}
        />
      )}

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
                onClick={() => openEdit(billboard)}
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
              {!bulk.bulkMode && (
                <AdminItemActions
                  onView={() => setPreviewBillboard(billboard)}
                  onEdit={() => openEdit(billboard)}
                  onDelete={() => handleDelete(billboard)}
                />
              )}
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

      {apiBillboards.length > 0 && (
        <AdminDataTable
          data={apiBillboards}
          searchKeys={["title", "city"]}
          columns={[
            {
              key: "source",
              label: "منبع",
              render: () => <Badge variant="secondary">API</Badge>,
            },
            { key: "title", label: "عنوان" },
            ...(isFullAdmin ? [adminOwnerTableColumn<Billboard>()] : []),
            {
              key: "category",
              label: "دسته",
              render: (item: Billboard) => (
                <Badge variant="outline">{resolveBillboardCategoryLabel(item)}</Badge>
              ),
            },
            { key: "city", label: "شهر" },
            {
              key: "status",
              label: "وضعیت",
              render: (item) =>
                item.status === "draft" || item.status === "published" ? (
                  <span className="text-xs text-muted-foreground">—</span>
                ) : (
                  <Badge status={item.status}>{getStatusLabel(item.status)}</Badge>
                ),
            },
            ...(showExternalPeriodTools
              ? [
                  {
                    key: "periods",
                    label: "دوره‌ها",
                    render: (item: Billboard) =>
                      canManageBillboardPeriods(item) ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPeriodBillboard(item);
                            setPeriodOpen(true);
                          }}
                        >
                          افزودن دوره
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      ),
                  },
                ]
              : []),
          ]}
          onEdit={() => undefined}
          onDelete={handleDelete}
          isReadOnly={isApiBillboard}
        />
      )}

      <AdminContentPreviewDialog
        open={Boolean(previewBillboard)}
        onOpenChange={(open) => !open && setPreviewBillboard(null)}
        title={previewBillboard?.title ?? "نمایش تبلیغات محیطی"}
        description={previewBillboard?.description}
        imageUrl={previewBillboard ? getBillboardDisplayImage(previewBillboard) : null}
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
      />
    </div>
  );
}
