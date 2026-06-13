"use client";

import { useState, useTransition } from "react";
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
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { PersianDateField } from "@/components/ui/persian-date-input";
import { saveAnalyticsAction, deleteAnalyticsAction } from "@/lib/actions/admin-actions";
import { todayISO } from "@/lib/jalali";
import type { AnalyticsMetric } from "@/lib/types";
import { formatPersianDate, getStatusLabel } from "@/lib/utils";

const schema = z.object({
  date: z.string(),
  visitors: z.coerce.number(),
  uniqueVisitors: z.coerce.number(),
  pageViews: z.coerce.number(),
  avgSessionDuration: z.coerce.number(),
  source: z.enum(["instagram", "telegram", "direct", "google", "referral", "other"]).optional(),
  device: z.enum(["mobile", "desktop", "tablet"]).optional(),
  page: z.string().optional(),
  city: z.string().optional(),
});

interface AnalyticsAdminProps {
  campaignId: string;
  initialMetrics: AnalyticsMetric[];
}

export function AnalyticsAdmin({ campaignId, initialMetrics }: AnalyticsAdminProps) {
  const [metrics, setMetrics] = useState(initialMetrics);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const form = useForm({ resolver: zodResolver(schema), defaultValues: { date: todayISO(), visitors: 0, uniqueVisitors: 0, pageViews: 0, avgSessionDuration: 120 } });

  const onSubmit = form.handleSubmit((data) => {
    startTransition(async () => {
      await saveAnalyticsAction({ ...data, campaignId, id: editingId ?? undefined });
      if (editingId) {
        setMetrics((p) => p.map((m) => m.id === editingId ? { ...m, ...data } as AnalyticsMetric : m));
      } else {
        setMetrics((p) => [...p, { id: crypto.randomUUID(), campaignId, createdAt: new Date().toISOString(), ...data }]);
      }
      toast.success("ذخیره شد");
      setOpen(false);
    });
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">آمار بازدید</h1>
          <p className="text-sm text-muted-foreground">مدیریت داده‌های آماری دستی (قابل اتصال به GA4/Plausible)</p>
        </div>
        <Button onClick={() => { setEditingId(null); form.reset(); setOpen(true); }}><Plus className="h-4 w-4" /> افزودن</Button>
      </div>

      <AdminDataTable
        data={metrics}
        searchKeys={["date", "city", "page"]}
        columns={[
          { key: "date", label: "تاریخ", render: (i) => formatPersianDate(i.date) },
          { key: "visitors", label: "بازدید" },
          { key: "pageViews", label: "صفحات" },
          { key: "source", label: "منبع", render: (i) => i.source ? getStatusLabel(i.source) : "—" },
          { key: "device", label: "دستگاه", render: (i) => i.device ? getStatusLabel(i.device) : "—" },
          { key: "city", label: "شهر" },
        ]}
        onEdit={(i) => {
          setEditingId(i.id);
          form.reset({
            date: i.date,
            visitors: i.visitors,
            uniqueVisitors: i.uniqueVisitors,
            pageViews: i.pageViews,
            avgSessionDuration: i.avgSessionDuration,
            source: i.source ?? undefined,
            device: i.device ?? undefined,
            page: i.page ?? undefined,
            city: i.city ?? undefined,
          });
          setOpen(true);
        }}
        onDelete={(i) => { startTransition(async () => { await deleteAnalyticsAction(i.id); setMetrics((p) => p.filter((m) => m.id !== i.id)); toast.success("حذف شد"); }); }}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "ویرایش" : "افزودن"} رکورد آمار</DialogTitle></DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <PersianDateField control={form.control} name="date" label="تاریخ (شمسی)" />
            <div className="grid grid-cols-2 gap-4">
              <div><Label>بازدیدکنندگان</Label><Input type="number" {...form.register("visitors")} /></div>
              <div><Label>یکتا</Label><Input type="number" {...form.register("uniqueVisitors")} /></div>
              <div><Label>بازدید صفحات</Label><Input type="number" {...form.register("pageViews")} /></div>
              <div><Label>میانگین نشست (ثانیه)</Label><Input type="number" {...form.register("avgSessionDuration")} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>منبع</Label>
                <Select value={form.watch("source") ?? ""} onValueChange={(v) => form.setValue("source", v as "instagram" | "telegram" | "direct" | "google" | "referral" | "other")}>
                  <SelectTrigger><SelectValue placeholder="انتخاب" /></SelectTrigger>
                  <SelectContent>
                    {["instagram", "telegram", "direct", "google", "referral", "other"].map((s) => (
                      <SelectItem key={s} value={s}>{getStatusLabel(s)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>دستگاه</Label>
                <Select value={form.watch("device") ?? ""} onValueChange={(v) => form.setValue("device", v as "mobile" | "desktop" | "tablet")}>
                  <SelectTrigger><SelectValue placeholder="انتخاب" /></SelectTrigger>
                  <SelectContent>
                    {["mobile", "desktop", "tablet"].map((d) => (
                      <SelectItem key={d} value={d}>{getStatusLabel(d)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>صفحه</Label><Input {...form.register("page")} dir="ltr" /></div>
              <div><Label>شهر</Label><Input {...form.register("city")} /></div>
            </div>
            <Button type="submit" disabled={isPending}>ذخیره تغییرات</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
