"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { saveBillboardAction, deleteBillboardAction } from "@/lib/actions/admin-actions";
import { canManageBillboardPeriods, isApiBillboard } from "@/lib/billboards";
import type { Billboard } from "@/lib/types";
import { getStatusLabel } from "@/lib/utils";

interface ContributorProfile {
  province?: string | null;
  city?: string | null;
  email: string;
  name: string;
}

interface BillboardsAdminProps {
  campaignId: string;
  initialBillboards: Billboard[];
  liveApiEnabled?: boolean;
  externalCampaignSlug?: string | null;
  externalCampaignId?: string | null;
  isFullAdmin?: boolean;
  contributorProfile?: ContributorProfile | null;
}

export function BillboardsAdmin({
  campaignId,
  initialBillboards,
  liveApiEnabled = false,
  externalCampaignSlug = null,
  externalCampaignId = null,
  isFullAdmin = true,
  contributorProfile = null,
}: BillboardsAdminProps) {
  const router = useRouter();
  const [billboards, setBillboards] = useState(initialBillboards);
  const [formOpen, setFormOpen] = useState(false);
  const [editingBillboard, setEditingBillboard] = useState<Billboard | null>(null);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [periodBillboard, setPeriodBillboard] = useState<Billboard | null>(null);
  const [isNormalizing, setIsNormalizing] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setBillboards(initialBillboards);
  }, [initialBillboards]);

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

  const manualBillboards = billboards.filter((billboard) => !isApiBillboard(billboard));
  const apiBillboards = billboards.filter((billboard) => isApiBillboard(billboard));
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

  const handleTogglePublish = (item: Billboard) => {
    if (isApiBillboard(item)) return;
    startTransition(async () => {
      const updated = { ...item, published: !item.published };
      await saveBillboardAction(updated);
      setBillboards((prev) => prev.map((billboard) => (billboard.id === item.id ? updated : billboard)));
      toast.success(updated.published ? "منتشر شد" : "از انتشار خارج شد");
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
            {apiBillboards.length > 0
              ? ` — ${apiBillboards.length} مورد قدیمی از Map-Bilboard فقط برای مشاهده است.`
              : ""}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          ثبت جدید
        </Button>
      </div>

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
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {manualBillboards.map((billboard) => (
            <AdminBillboardCompactCard
              key={billboard.id}
              billboard={billboard}
              onClick={() => openEdit(billboard)}
            />
          ))}
          <AdminBillboardAddCard onClick={openCreate} />
        </div>
      )}

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
            { key: "city", label: "شهر" },
            {
              key: "status",
              label: "وضعیت",
              render: (item) => <Badge status={item.status}>{getStatusLabel(item.status)}</Badge>,
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
          onTogglePublish={handleTogglePublish}
          getPublished={(item) => item.published}
          isReadOnly={isApiBillboard}
        />
      )}
    </div>
  );
}
