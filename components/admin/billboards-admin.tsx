"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { adminOwnerTableColumn } from "@/components/admin/admin-owner-badge";
import { MapBilboardBackupImportPanel } from "@/components/admin/map-bilboard-backup-import-panel";
import { BillboardIntegrationImportPanel } from "@/components/admin/billboard-integration-import-panel";
import { MediaUpload } from "@/components/ui/media-upload";
import { PersianDateField } from "@/components/ui/persian-date-input";
import { Badge } from "@/components/ui/badge";
import { saveBillboardAction, deleteBillboardAction } from "@/lib/actions/admin-actions";
import { isApiBillboard } from "@/lib/billboards";
import { todayISO } from "@/lib/jalali";
import type { Billboard } from "@/lib/types";
import { getStatusLabel } from "@/lib/utils";

const schema = z.object({
  title: z.string().min(1, "عنوان الزامی است"),
  city: z.string().min(1, "شهر الزامی است"),
  location: z.string().min(1, "موقعیت الزامی است"),
  date: z.string().min(1, "تاریخ الزامی است"),
  thumbnailUrl: z.string().min(1, "تصویر الزامی است"),
  externalUrl: z.string().url("آدرس لینک نامعتبر").or(z.literal("")),
  latitude: z.coerce.number().optional(),
  longitude: z.coerce.number().optional(),
  status: z.enum(["draft", "published", "completed"]),
  tags: z.string(),
  notes: z.string().optional(),
  published: z.boolean(),
  sortOrder: z.coerce.number(),
});

type FormData = z.infer<typeof schema>;

interface BillboardsAdminProps {
  campaignId: string;
  initialBillboards: Billboard[];
  liveApiEnabled?: boolean;
  externalCampaignSlug?: string | null;
}

export function BillboardsAdmin({
  campaignId,
  initialBillboards,
  liveApiEnabled = false,
  externalCampaignSlug = null,
}: BillboardsAdminProps) {
  const router = useRouter();
  const [billboards, setBillboards] = useState(initialBillboards);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Billboard | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setBillboards(initialBillboards);
  }, [initialBillboards]);

  const manualBillboards = billboards.filter((billboard) => !isApiBillboard(billboard));
  const apiBillboardCount = billboards.length - manualBillboards.length;

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      city: "",
      location: "",
      date: todayISO(),
      thumbnailUrl: "",
      externalUrl: "",
      latitude: undefined,
      longitude: undefined,
      status: "draft",
      tags: "",
      notes: "",
      published: false,
      sortOrder: manualBillboards.length + 1,
    },
  });

  const openCreate = () => {
    setEditing(null);
    form.reset({
      title: "",
      city: "",
      location: "",
      date: todayISO(),
      thumbnailUrl: "",
      externalUrl: "",
      latitude: undefined,
      longitude: undefined,
      status: "draft",
      tags: "",
      notes: "",
      published: false,
      sortOrder: manualBillboards.length + 1,
    });
    setOpen(true);
  };

  const openEdit = (item: Billboard) => {
    if (isApiBillboard(item)) return;
    setEditing(item);
    form.reset({
      title: item.title,
      city: item.city,
      location: item.location,
      date: item.date,
      thumbnailUrl: item.thumbnailUrl,
      externalUrl: item.externalUrl,
      latitude: item.latitude ?? undefined,
      longitude: item.longitude ?? undefined,
      status: item.status as FormData["status"],
      tags: item.tags.join(", "),
      notes: item.notes ?? "",
      published: item.published,
      sortOrder: item.sortOrder,
    });
    setOpen(true);
  };

  const onSubmit = (data: FormData) => {
    startTransition(async () => {
      const payload = {
        ...data,
        campaignId,
        id: editing?.id,
        tags: data.tags.split(",").map((t) => t.trim()).filter(Boolean),
        thumbnailUrl: data.thumbnailUrl || "https://via.placeholder.com/400x300",
        externalUrl: data.externalUrl || "https://example.com",
      };
      await saveBillboardAction(payload);
      if (editing) {
        setBillboards((prev) =>
          prev.map((b) => (b.id === editing.id ? { ...b, ...payload } as Billboard : b))
        );
        toast.success("بیلبورد ویرایش شد");
      } else {
        const newItem: Billboard = {
          ...payload,
          id: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as Billboard;
        setBillboards((prev) => [...prev, newItem]);
        toast.success("بیلبورد افزوده شد");
      }
      setOpen(false);
    });
  };

  const handleDelete = (item: Billboard) => {
    if (isApiBillboard(item)) return;
    startTransition(async () => {
      await deleteBillboardAction(item.id);
      setBillboards((prev) => prev.filter((b) => b.id !== item.id));
      toast.success("بیلبورد حذف شد");
    });
  };

  const handleTogglePublish = (item: Billboard) => {
    if (isApiBillboard(item)) return;
    startTransition(async () => {
      const updated = { ...item, published: !item.published };
      await saveBillboardAction(updated);
      setBillboards((prev) =>
        prev.map((b) => (b.id === item.id ? updated : b))
      );
      toast.success(updated.published ? "منتشر شد" : "از انتشار خارج شد");
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">بیلبوردها</h1>
          <p className="text-sm text-muted-foreground">
            بیلبوردهای دستی قابل ویرایش هستند.
            {liveApiEnabled ? (
              apiBillboardCount > 0 ? (
                <> {apiBillboardCount} بیلبورد از Map Bilboard به‌صورت زنده نمایش داده می‌شود (فقط مشاهده).</>
              ) : (
                <> اتصال API فعال است — بیلبوردی از API دریافت نشد.</>
              )
            ) : (
              <>
                {" "}
                برای دریافت زنده از Map Bilboard به{" "}
                <Link href={`/admin/settings?campaign=${campaignId}`} className="text-primary hover:underline">
                  تنظیمات کمپین
                </Link>{" "}
                بروید.
              </>
            )}
          </p>
        </div>
        <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            افزودن
        </Button>
      </div>

      <BillboardIntegrationImportPanel
        campaignId={campaignId}
        externalCampaignSlug={externalCampaignSlug}
        existingBillboards={billboards}
        onImported={() => router.refresh()}
      />

      <MapBilboardBackupImportPanel
        campaignId={campaignId}
        externalCampaignSlug={externalCampaignSlug}
        onImported={() => router.refresh()}
      />

      <AdminDataTable
        data={billboards}
        searchKeys={["title", "city"]}
        columns={[
          {
            key: "source",
            label: "منبع",
            render: (item) =>
              isApiBillboard(item) ? (
                <Badge variant="secondary">API</Badge>
              ) : (
                <Badge variant="outline">دستی</Badge>
              ),
          },
          { key: "title", label: "عنوان" },
          adminOwnerTableColumn<Billboard>(),
          { key: "city", label: "شهر" },
          {
            key: "status",
            label: "وضعیت",
            render: (item) => <Badge status={item.status}>{getStatusLabel(item.status)}</Badge>,
          },
          {
            key: "published",
            label: "انتشار",
            render: (item) => (
              <Badge variant={item.published ? "success" : "secondary"}>
                {item.published ? "منتشر" : "پیش‌نویس"}
              </Badge>
            ),
          },
          { key: "sortOrder", label: "ترتیب" },
        ]}
        onEdit={openEdit}
        onDelete={handleDelete}
        onTogglePublish={handleTogglePublish}
        getPublished={(item) => item.published}
        isReadOnly={isApiBillboard}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "ویرایش بیلبورد" : "افزودن بیلبورد"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>عنوان</Label>
              <Input {...form.register("title")} />
              {form.formState.errors.title && (
                <p className="text-xs text-destructive">{form.formState.errors.title.message}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>شهر</Label>
                <Input {...form.register("city")} />
              </div>
              <PersianDateField control={form.control} name="date" label="تاریخ (شمسی)" />
            </div>
            <div className="space-y-2">
              <Label>موقعیت</Label>
              <Input {...form.register("location")} />
            </div>
            <MediaUpload
              label="تصویر"
              value={form.watch("thumbnailUrl")}
              onChange={(url) => form.setValue("thumbnailUrl", url)}
            />
            <div className="space-y-2">
              <Label>لینک خارجی</Label>
              <Input {...form.register("externalUrl")} dir="ltr" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>عرض جغرافیایی (اختیاری)</Label>
                <Input type="number" step="any" {...form.register("latitude")} dir="ltr" placeholder="35.6892" />
              </div>
              <div className="space-y-2">
                <Label>طول جغرافیایی (اختیاری)</Label>
                <Input type="number" step="any" {...form.register("longitude")} dir="ltr" placeholder="51.3890" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>برچسب‌ها (با کاما جدا کنید)</Label>
              <Input {...form.register("tags")} />
            </div>
            <div className="space-y-2">
              <Label>یادداشت</Label>
              <Textarea {...form.register("notes")} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>وضعیت</Label>
                <Select
                  value={form.watch("status")}
                  onValueChange={(v) => form.setValue("status", v as FormData["status"])}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">پیش‌نویس</SelectItem>
                    <SelectItem value="published">منتشر شده</SelectItem>
                    <SelectItem value="completed">تکمیل شده</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>ترتیب</Label>
                <Input type="number" {...form.register("sortOrder")} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.watch("published")}
                onCheckedChange={(v) => form.setValue("published", v)}
              />
              <Label>منتشر شود</Label>
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
              {isPending ? "در حال ذخیره..." : "ذخیره تغییرات"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
