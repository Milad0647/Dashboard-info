"use client";

import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AdminContentFilterBar,
  buildAdminFilterSources,
  DEFAULT_ADMIN_CONTENT_FILTER,
  matchesAdminContentFilter,
  sortAdminContentItems,
  type AdminContentFilterState,
} from "@/components/admin/admin-content-filter-bar";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { adminOwnerTableColumn } from "@/components/admin/admin-owner-badge";
import { PersianDateField } from "@/components/ui/persian-date-input";
import { saveAnalyticsAction, deleteAnalyticsAction } from "@/lib/actions/admin-actions";
import { useSectionCreateGate } from "@/lib/hooks/use-section-create-gate";
import { todayISO } from "@/lib/jalali";
import type { AdminUser, AnalyticsMetric } from "@/lib/types";
import { formatPersianDate, getStatusLabel } from "@/lib/utils";

const schema = z.object({
  date: z.string(),
  visitors: z.coerce.number(),
  uniqueVisitors: z.coerce.number(),
  pageViews: z.coerce.number(),
  avgSessionDuration: z.coerce.number(),
  source: z.enum(["direct", "google", "referral", "other"]).optional(),
  device: z.enum(["mobile", "desktop", "tablet"]).optional(),
  page: z.string().optional(),
  city: z.string().optional(),
});

interface AnalyticsAdminProps {
  campaignId: string;
  initialMetrics: AnalyticsMetric[];
  contentPlans?: string[];
  isFullAdmin?: boolean;
  canTransferOwnership?: boolean;
  users?: AdminUser[];
}

export function AnalyticsAdmin({
  campaignId,
  initialMetrics,
  contentPlans = [],
  isFullAdmin = false,
  canTransferOwnership = false,
  users = [],
}: AnalyticsAdminProps) {
  const { requestCreate, tutorialModal } = useSectionCreateGate("analytics");
  const siteMetrics = useMemo(
    () => initialMetrics.filter((metric) => (metric.channel ?? "site") === "site"),
    [initialMetrics]
  );

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [rows, setRows] = useState(siteMetrics);
  const [contentFilter, setContentFilter] = useState<AdminContentFilterState>(DEFAULT_ADMIN_CONTENT_FILTER);

  const { users: filterUsers, locations: filterLocations } = useMemo(
    () => buildAdminFilterSources(rows, users, canTransferOwnership || isFullAdmin),
    [rows, users, canTransferOwnership, isFullAdmin]
  );

  const filteredRows = useMemo(
    () =>
      sortAdminContentItems(
        rows.filter((item) => matchesAdminContentFilter(item, contentFilter)),
        contentFilter.sortOrder,
        (item) => item.date || item.createdAt
      ),
    [rows, contentFilter]
  );

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { date: todayISO(), visitors: 0, uniqueVisitors: 0, pageViews: 0, avgSessionDuration: 120 },
  });

  const onSubmit = form.handleSubmit((data) => {
    startTransition(async () => {
      await saveAnalyticsAction({ ...data, campaignId, channel: "site", id: editingId ?? undefined });
      if (editingId) {
        setRows((prev) =>
          prev.map((metric) =>
            metric.id === editingId ? ({ ...metric, ...data, channel: "site" } as AnalyticsMetric) : metric
          )
        );
      } else {
        setRows((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            campaignId,
            channel: "site",
            createdAt: new Date().toISOString(),
            ...data,
          } as AnalyticsMetric,
        ]);
      }
      toast.success("ذخیره شد");
      setOpen(false);
    });
  });

  const openCreate = () => {
    void requestCreate(() => {
      setEditingId(null);
      form.reset({
        date: todayISO(),
        visitors: 0,
        uniqueVisitors: 0,
        pageViews: 0,
        avgSessionDuration: 120,
      });
      setOpen(true);
    });
  };

  return (
    <div className="space-y-6">
      {tutorialModal}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">آمار سایت</h1>
          <p className="text-sm text-muted-foreground">
            بازدید صفحات، منابع ورود و دستگاه‌ها — آمار شبکه‌های اجتماعی در بخش جداگانه ثبت می‌شود
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> افزودن
        </Button>
      </div>

      <AdminContentFilterBar
        filter={contentFilter}
        onChange={setContentFilter}
        users={filterUsers}
        plans={contentPlans}
        locations={filterLocations}
      />

      <AdminDataTable
        data={filteredRows}
        searchKeys={["date", "city", "page"]}
        columns={[
          { key: "date", label: "تاریخ", render: (item) => formatPersianDate(item.date) },
          adminOwnerTableColumn<AnalyticsMetric>(),
          { key: "visitors", label: "بازدید" },
          { key: "pageViews", label: "صفحات" },
          { key: "source", label: "منبع", render: (item) => (item.source ? getStatusLabel(item.source) : "—") },
          { key: "device", label: "دستگاه", render: (item) => (item.device ? getStatusLabel(item.device) : "—") },
          { key: "city", label: "شهر" },
        ]}
        onView={(item) => {
          const siteSource =
            item.source && ["direct", "google", "referral", "other"].includes(item.source)
              ? (item.source as "direct" | "google" | "referral" | "other")
              : undefined;
          setEditingId(item.id);
          form.reset({
            date: item.date,
            visitors: item.visitors,
            uniqueVisitors: item.uniqueVisitors,
            pageViews: item.pageViews,
            avgSessionDuration: item.avgSessionDuration,
            source: siteSource,
            device: item.device ?? undefined,
            page: item.page ?? undefined,
            city: item.city ?? undefined,
          });
          setOpen(true);
        }}
        onEdit={(item) => {
          const siteSource =
            item.source && ["direct", "google", "referral", "other"].includes(item.source)
              ? (item.source as "direct" | "google" | "referral" | "other")
              : undefined;
          setEditingId(item.id);
          form.reset({
            date: item.date,
            visitors: item.visitors,
            uniqueVisitors: item.uniqueVisitors,
            pageViews: item.pageViews,
            avgSessionDuration: item.avgSessionDuration,
            source: siteSource,
            device: item.device ?? undefined,
            page: item.page ?? undefined,
            city: item.city ?? undefined,
          });
          setOpen(true);
        }}
        onDelete={(item) => {
          startTransition(async () => {
            await deleteAnalyticsAction(item.id);
            setRows((prev) => prev.filter((metric) => metric.id !== item.id));
            toast.success("حذف شد");
          });
        }}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "ویرایش" : "افزودن"} رکورد آمار سایت</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <PersianDateField control={form.control} name="date" label="تاریخ (شمسی)" />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>بازدیدکنندگان</Label>
                <Input type="number" {...form.register("visitors")} />
              </div>
              <div>
                <Label>یکتا</Label>
                <Input type="number" {...form.register("uniqueVisitors")} />
              </div>
              <div>
                <Label>بازدید صفحات</Label>
                <Input type="number" {...form.register("pageViews")} />
              </div>
              <div>
                <Label>میانگین نشست (ثانیه)</Label>
                <Input type="number" {...form.register("avgSessionDuration")} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>منبع</Label>
                <Select
                  value={form.watch("source") ?? ""}
                  onValueChange={(value) =>
                    form.setValue("source", value as "direct" | "google" | "referral" | "other")
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="انتخاب" />
                  </SelectTrigger>
                  <SelectContent>
                    {(["direct", "google", "referral", "other"] as const).map((source) => (
                      <SelectItem key={source} value={source}>
                        {getStatusLabel(source)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>دستگاه</Label>
                <Select
                  value={form.watch("device") ?? ""}
                  onValueChange={(value) =>
                    form.setValue("device", value as "mobile" | "desktop" | "tablet")
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="انتخاب" />
                  </SelectTrigger>
                  <SelectContent>
                    {(["mobile", "desktop", "tablet"] as const).map((device) => (
                      <SelectItem key={device} value={device}>
                        {getStatusLabel(device)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>صفحه</Label>
                <Input {...form.register("page")} dir="ltr" />
              </div>
              <div>
                <Label>شهر</Label>
                <Input {...form.register("city")} />
              </div>
            </div>
            <Button type="submit" disabled={isPending}>
              ذخیره تغییرات
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
