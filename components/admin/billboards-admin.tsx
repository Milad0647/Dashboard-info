"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AdminContentFilterBar,
  collectAdminFilterUsers,
  DEFAULT_ADMIN_CONTENT_FILTER,
  matchesAdminContentFilter,
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
import { resolveBillboardCategoryLabel } from "@/lib/billboard-categories";
import { canManageBillboardPeriods, isApiBillboard } from "@/lib/billboards";
import { getBillboardDisplayImage } from "@/lib/billboard-media";
import type { ContentTopic } from "@/lib/content-topics";
import { useAdminViewMode } from "@/lib/hooks/use-admin-view-mode";
import { useAdminInfiniteScroll } from "@/lib/hooks/use-admin-infinite-scroll";
import { AdminInfiniteScrollSentinel } from "@/components/admin/admin-infinite-scroll-sentinel";
import type { AdminUser, Billboard } from "@/lib/types";
import { getStatusLabel } from "@/lib/utils";
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
  users = [],
  contributorProfile = null,
}: BillboardsAdminProps) {
  const router = useRouter();
  const [billboards, setBillboards] = useState(initialBillboards);
  const [formOpen, setFormOpen] = useState(false);
  const [editingBillboard, setEditingBillboard] = useState<Billboard | null>(null);
  const [previewBillboard, setPreviewBillboard] = useState<Billboard | null>(null);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [periodBillboard, setPeriodBillboard] = useState<Billboard | null>(null);
  const [isNormalizing, setIsNormalizing] = useState(false);
  const [contentFilter, setContentFilter] = useState<AdminContentFilterState>(DEFAULT_ADMIN_CONTENT_FILTER);
  const { viewMode, setViewMode } = useAdminViewMode("billboards");
  const [, startTransition] = useTransition();

  useEffect(() => {
    setBillboards(initialBillboards);
  }, [initialBillboards]);

  const filterUsers = useMemo(() => collectAdminFilterUsers(billboards), [billboards]);
  const filteredBillboards = useMemo(
    () => billboards.filter((item) => matchesAdminContentFilter(item, contentFilter)),
    [billboards, contentFilter]
  );

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
  const paginationResetKey = `${contentFilter.userKey}:${contentFilter.planLabels.join(",")}:${viewMode}`;
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
    setEditingBillboard(null);
    setFormOpen(true);
  };

  const openEdit = (billboard: Billboard) => {
    if (isApiBillboard(billboard)) return;
    setEditingBillboard(billboard);
    setFormOpen(true);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">تبلیغات محیطی</h1>
          <p className="text-sm text-muted-foreground">
            استرابورد، بنر، بیلبورد، لایت‌باکس، مانیتور و سایر رسانه‌های محیطی
            {allApiBillboards.length > 0
              ? ` — ${allApiBillboards.length} مورد قدیمی از Map-Bilboard فقط برای مشاهده است.`
              : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AdminViewModeToggle value={viewMode} onChange={setViewMode} />
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            ثبت جدید
          </Button>
        </div>
      </div>

      <AdminContentFilterBar
        filter={contentFilter}
        onChange={setContentFilter}
        users={isFullAdmin ? filterUsers : []}
        plans={contentPlans}
      />

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
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingBillboard(null);
        }}
        campaignId={campaignId}
        contentPlans={contentPlans}
        contentTopics={contentTopics}
        canScore={canScore}
        mode={isFullAdmin ? "admin" : "client"}
        contributorProfile={contributorProfile}
        editingBillboard={editingBillboard}
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
        <div className="rounded-xl border py-12 text-center text-muted-foreground">
          هنوز تبلیغات محیطی ثبت نشده است.
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
