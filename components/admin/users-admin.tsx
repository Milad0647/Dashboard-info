"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProvinceCityFields } from "@/components/admin/province-city-fields";
import { AdminDataTable } from "@/components/admin/admin-data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsersImportPanel } from "@/components/admin/users-import-panel";
import { normalizeStoredUserEmail } from "@/lib/auth/user-login";
import { deleteUserAction, saveUserAction } from "@/lib/actions/extended-actions";
import {
  contributorPermissionLabels,
  defaultContributorPermissions,
  type ContributorPermissionKey,
  type ContributorPermissions,
} from "@/lib/contributor-permissions";
import type { AdminUser, CampaignSettings } from "@/lib/types";

const schema = z.object({
  email: z.string().min(1, "نام کاربری یا ایمیل الزامی است"),
  name: z.string().min(1),
  role: z.enum(["admin", "contributor"]),
  password: z.string().optional(),
  province: z.string().optional(),
  city: z.string().optional(),
  campaignIds: z.array(z.string()),
});

const permissionKeys = Object.keys(contributorPermissionLabels) as ContributorPermissionKey[];

interface UsersAdminProps {
  initialUsers: AdminUser[];
  campaigns: CampaignSettings[];
}

export function UsersAdmin({ initialUsers, campaigns }: UsersAdminProps) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rows, setRows] = useState(initialUsers);
  const [campaignPermissions, setCampaignPermissions] = useState<Record<string, ContributorPermissions>>({});
  const [isPending, startTransition] = useTransition();

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      name: "",
      role: "contributor" as const,
      password: "",
      province: "",
      city: "",
      campaignIds: [] as string[],
    },
  });

  const selectedCampaignIds = form.watch("campaignIds");
  const selectedRole = form.watch("role");
  const selectedProvince = form.watch("province");
  const selectedCity = form.watch("city");

  const toggleCampaign = (campaignId: string) => {
    const current = form.getValues("campaignIds");
    if (current.includes(campaignId)) {
      form.setValue(
        "campaignIds",
        current.filter((id) => id !== campaignId)
      );
      return;
    }

    form.setValue("campaignIds", [...current, campaignId]);
    setCampaignPermissions((prev) => ({
      ...prev,
      [campaignId]: prev[campaignId] ?? defaultContributorPermissions(),
    }));
  };

  const togglePermission = (campaignId: string, key: ContributorPermissionKey, value: boolean) => {
    setCampaignPermissions((prev) => ({
      ...prev,
      [campaignId]: {
        ...(prev[campaignId] ?? defaultContributorPermissions()),
        [key]: value,
      },
    }));
  };

  const onSubmit = form.handleSubmit((data) => {
    if (!editingId && !data.password) {
      toast.error("رمز عبور الزامی است");
      return;
    }

    startTransition(async () => {
      const result = await saveUserAction({
        ...data,
        email: normalizeStoredUserEmail(data.email),
        id: editingId ?? undefined,
        province: data.province?.trim() || null,
        city: data.city?.trim() || null,
        campaignPermissions: data.role === "contributor" ? campaignPermissions : undefined,
      });
      if (!result.success) {
        toast.error(result.error ?? "ذخیره نشد");
        return;
      }

      const savedId = "id" in result ? result.id : (editingId ?? crypto.randomUUID());

      const nextUser: AdminUser = {
        id: savedId,
        email: normalizeStoredUserEmail(data.email),
        name: data.name,
        role: data.role,
        province: data.province?.trim() || null,
        city: data.city?.trim() || null,
        campaignIds: data.campaignIds,
        campaignPermissions: data.role === "contributor" ? campaignPermissions : {},
        createdAt: new Date().toISOString(),
      };

      setRows((prev) =>
        editingId ? prev.map((row) => (row.id === editingId ? { ...row, ...nextUser } : row)) : [...prev, nextUser]
      );
      toast.success("ذخیره شد");
      setOpen(false);
    });
  });

  const openCreate = () => {
    setEditingId(null);
    setCampaignPermissions({});
    form.reset({ email: "", name: "", role: "contributor", password: "", province: "", city: "", campaignIds: [] });
    setOpen(true);
  };

  const openEdit = (user: AdminUser) => {
    setEditingId(user.id);
    setCampaignPermissions(user.campaignPermissions);
    form.reset({
      email: user.email,
      name: user.name,
      role: user.role,
      password: "",
      province: user.province ?? "",
      city: user.city ?? "",
      campaignIds: user.campaignIds,
    });
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">کاربران</h1>
        <p className="text-sm text-muted-foreground">
          تعریف کاربر، ورود گروهی از Excel، دسترسی به کمپین و بخش‌های پنل
        </p>
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">لیست کاربران</TabsTrigger>
          <TabsTrigger value="import">ورود از Excel</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              کاربر جدید
            </Button>
          </div>

      <AdminDataTable
        data={rows}
        searchKeys={["name", "email", "role", "province", "city"]}
        columns={[
          { key: "name", label: "نام" },
          { key: "email", label: "نام کاربری / ایمیل" },
          { key: "province", label: "استان", render: (item) => item.province || "—" },
          { key: "city", label: "شهر", render: (item) => item.city || "—" },
          { key: "role", label: "نقش", render: (item) => (item.role === "admin" ? "مدیر" : "کاربر") },
          {
            key: "campaignIds",
            label: "کمپین‌ها",
            render: (item) =>
              item.campaignIds
                .map((id) => campaigns.find((campaign) => campaign.id === id)?.title ?? id)
                .join("، ") || "—",
          },
        ]}
        onEdit={openEdit}
        onDelete={(user) => {
          startTransition(async () => {
            await deleteUserAction(user.id);
            setRows((prev) => prev.filter((row) => row.id !== user.id));
            toast.success("حذف شد");
          });
        }}
      />
        </TabsContent>

        <TabsContent value="import" className="mt-4">
          <UsersImportPanel
            campaigns={campaigns}
            onImported={() => {
              window.location.reload();
            }}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "ویرایش کاربر" : "کاربر جدید"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2"><Label>نام</Label><Input {...form.register("name")} /></div>
            <div className="space-y-2">
              <Label>نام کاربری یا ایمیل</Label>
              <Input {...form.register("email")} dir="ltr" placeholder="BAZARBAYJAN یا user@example.com" />
            </div>
            <ProvinceCityFields
              province={selectedProvince ?? ""}
              city={selectedCity ?? ""}
              onProvinceChange={(value) => form.setValue("province", value)}
              onCityChange={(value) => form.setValue("city", value)}
            />
            <div className="space-y-2">
              <Label>{editingId ? "رمز عبور جدید (اختیاری)" : "رمز عبور"}</Label>
              <Input type="password" {...form.register("password")} />
            </div>
            <div className="space-y-2">
              <Label>نقش</Label>
              <Select value={selectedRole} onValueChange={(value) => form.setValue("role", value as "admin" | "contributor")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contributor">کاربر (فقط داده خودش)</SelectItem>
                  <SelectItem value="admin">مدیر</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>دسترسی به کمپین‌ها</Label>
              <div className="space-y-2 rounded-lg border p-3">
                {campaigns.map((campaign) => (
                  <label key={campaign.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedCampaignIds.includes(campaign.id)}
                      onChange={() => toggleCampaign(campaign.id)}
                    />
                    {campaign.title}
                  </label>
                ))}
              </div>
            </div>

            {selectedRole === "contributor" && selectedCampaignIds.length > 0 && (
              <div className="space-y-3">
                <Label>دسترسی به بخش‌های پنل (برای هر کمپین)</Label>
                {selectedCampaignIds.map((campaignId) => {
                  const campaign = campaigns.find((item) => item.id === campaignId);
                  const permissions = campaignPermissions[campaignId] ?? defaultContributorPermissions();
                  return (
                    <div key={campaignId} className="rounded-lg border p-3 space-y-2">
                      <p className="text-sm font-medium">{campaign?.title ?? campaignId}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {permissionKeys.map((key) => (
                          <label key={key} className="flex items-center justify-between gap-3 text-sm rounded-md border px-3 py-2">
                            <span>{contributorPermissionLabels[key]}</span>
                            <Switch
                              checked={permissions[key]}
                              onCheckedChange={(value) => togglePermission(campaignId, key, value)}
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <Button type="submit" disabled={isPending} className="w-full">ذخیره</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
