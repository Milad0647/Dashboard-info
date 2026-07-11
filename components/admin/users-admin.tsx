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
import { getLoginUsernameFromEmail, normalizeStoredUserEmail } from "@/lib/auth/user-login";
import { normalizeImportedCity, normalizeImportedProvince } from "@/lib/iran-locations";
import {
  deleteUserAction,
  deleteUsersAction,
  saveUserAction,
  saveUserRegionAction,
} from "@/lib/actions/extended-actions";
import {
  contributorPermissionLabels,
  defaultContributorPermissions,
  normalizeContributorPermissions,
  type ContributorPermissionKey,
  type ContributorPermissions,
} from "@/lib/contributor-permissions";
import {
  USER_REGIONS,
  getUserRegionLabel,
  normalizeUserRegion,
  userRegionLabels,
  type UserRegion,
} from "@/lib/user-regions";
import type { AdminUser, CampaignSettings } from "@/lib/types";

const NO_REGION = "__none__";

const schema = z.object({
  email: z.string().min(1, "نام کاربری یا ایمیل الزامی است"),
  name: z.string().min(1),
  role: z.enum(["admin", "contributor", "client"]),
  password: z.string().optional(),
  province: z.string().optional(),
  city: z.string().optional(),
  region: z.enum(["north", "south", "east", "west"]).nullable().optional(),
  campaignIds: z.array(z.string()),
});

const permissionKeys = Object.keys(contributorPermissionLabels) as ContributorPermissionKey[];

interface UsersAdminProps {
  initialUsers: AdminUser[];
  campaigns: CampaignSettings[];
  /** full = admin; region = client can only set geographic region */
  mode?: "full" | "region";
}

export function UsersAdmin({
  initialUsers,
  campaigns,
  mode = "full",
}: UsersAdminProps) {
  const isFullMode = mode === "full";
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
      region: null as UserRegion | null,
      campaignIds: [] as string[],
    },
  });

  const selectedCampaignIds = form.watch("campaignIds") ?? [];
  const selectedRole = form.watch("role");
  const selectedProvince = form.watch("province");
  const selectedCity = form.watch("city");
  const selectedRegion = form.watch("region");

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
    if (!isFullMode) {
      if (!editingId) return;
      startTransition(async () => {
        const result = await saveUserRegionAction({
          userId: editingId,
          region: data.region ?? null,
        });
        if (!result.success) {
          toast.error("error" in result ? result.error : "ذخیره نشد");
          return;
        }
        setRows((prev) =>
          prev.map((row) =>
            row.id === editingId ? { ...row, region: normalizeUserRegion(data.region) } : row
          )
        );
        toast.success("دسته‌بندی ذخیره شد");
        setOpen(false);
      });
      return;
    }

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
        region: data.region ?? null,
        campaignPermissions: data.role === "contributor" || data.role === "client" ? campaignPermissions : undefined,
      });
      if (!result.success) {
        toast.error(result.error ?? "ذخیره نشد");
        return;
      }

      const savedId = "id" in result ? result.id : (editingId ?? crypto.randomUUID());
      const existing = rows.find((row) => row.id === editingId);

      const nextUser: AdminUser = {
        id: savedId!,
        email: normalizeStoredUserEmail(data.email),
        name: data.name,
        role: data.role,
        province: data.province?.trim() || null,
        city: data.city?.trim() || null,
        region: normalizeUserRegion(data.region),
        accountManagerName: existing?.accountManagerName ?? null,
        campaignIds: data.campaignIds,
        campaignPermissions: data.role === "contributor" || data.role === "client" ? campaignPermissions : {},
        createdAt: existing?.createdAt ?? new Date().toISOString(),
      };

      setRows((prev) =>
        editingId ? prev.map((row) => (row.id === editingId ? { ...row, ...nextUser } : row)) : [...prev, nextUser]
      );
      toast.success("ذخیره شد");
      setOpen(false);
    });
  });

  const openCreate = () => {
    if (!isFullMode) return;
    setEditingId(null);
    setCampaignPermissions({});
    form.reset({
      email: "",
      name: "",
      role: "contributor",
      password: "",
      province: "",
      city: "",
      region: null,
      campaignIds: [],
    });
    setOpen(true);
  };

  const openEdit = (user: AdminUser) => {
    setEditingId(user.id);
    const permissions = user.campaignPermissions ?? {};
    const normalizedProvince =
      normalizeImportedProvince(user.province ?? "") ?? user.province?.trim() ?? "";
    const normalizedCity =
      normalizeImportedCity(normalizedProvince, user.city ?? "") ?? user.city?.trim() ?? "";

    setCampaignPermissions(
      Object.fromEntries(
        Object.entries(permissions).map(([campaignId, value]) => [
          campaignId,
          normalizeContributorPermissions(value),
        ])
      )
    );
    form.reset({
      email: getLoginUsernameFromEmail(user.email ?? ""),
      name: user.name ?? "",
      role: user.role ?? "contributor",
      password: "",
      province: normalizedProvince,
      city: normalizedCity,
      region: normalizeUserRegion(user.region),
      campaignIds: user.campaignIds ?? [],
    });
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">کاربران</h1>
        <p className="text-sm text-muted-foreground">
          {isFullMode
            ? "تعریف کاربر، دسته‌بندی منطقه‌ای، ورود گروهی از Excel، دسترسی به کمپین و بخش‌های پنل"
            : "تعیین دسته‌بندی منطقه‌ای کاربران (شمال / جنوب / شرق / غرب)"}
        </p>
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">لیست کاربران</TabsTrigger>
          {isFullMode && <TabsTrigger value="import">ورود از Excel</TabsTrigger>}
        </TabsList>

        <TabsContent value="list" className="space-y-4 mt-4">
          {isFullMode && (
            <div className="flex justify-end">
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" />
                کاربر جدید
              </Button>
            </div>
          )}

          <AdminDataTable
            data={rows}
            selectable={isFullMode}
            searchKeys={["name", "email", "role", "province", "city", "region", "accountManagerName"]}
            columns={[
              { key: "name", label: "نام" },
              {
                key: "email",
                label: "نام کاربری",
                render: (item) => getLoginUsernameFromEmail(item.email),
              },
              { key: "province", label: "استان", render: (item) => item.province || "—" },
              {
                key: "region",
                label: "دسته منطقه‌ای",
                render: (item) => getUserRegionLabel(item.region),
              },
              {
                key: "accountManagerName",
                label: "مسئول اکانت",
                render: (item) => item.accountManagerName?.trim() || "—",
              },
              {
                key: "role",
                label: "نقش",
                render: (item) =>
                  item.role === "admin" ? "مدیر" : item.role === "client" ? "کارفرما" : "کاربر",
              },
              ...(isFullMode
                ? [
                    {
                      key: "campaignIds" as const,
                      label: "کمپین‌ها",
                      render: (item: AdminUser) =>
                        (item.campaignIds ?? [])
                          .map((id) => campaigns.find((campaign) => campaign.id === id)?.title ?? id)
                          .join("، ") || "—",
                    },
                  ]
                : []),
            ]}
            onEdit={openEdit}
            onDelete={
              isFullMode
                ? (user) => {
                    startTransition(async () => {
                      const result = await deleteUserAction(user.id);
                      if (!result.success) {
                        toast.error("error" in result ? result.error : "حذف نشد");
                        return;
                      }
                      setRows((prev) => prev.filter((row) => row.id !== user.id));
                      toast.success("حذف شد");
                    });
                  }
                : undefined
            }
            onBulkDelete={
              isFullMode
                ? (users) => {
                    startTransition(async () => {
                      const ids = users.map((user) => user.id);
                      const result = await deleteUsersAction(ids);
                      if (!result.success) {
                        toast.error("error" in result ? result.error : "حذف نشد");
                        return;
                      }
                      const deletedIds = new Set(ids);
                      setRows((prev) => prev.filter((row) => !deletedIds.has(row.id)));
                      toast.success(`${ids.length} کاربر حذف شد`);
                    });
                  }
                : undefined
            }
          />
        </TabsContent>

        {isFullMode && (
          <TabsContent value="import" className="mt-4">
            <UsersImportPanel
              campaigns={campaigns}
              onImported={() => {
                window.location.reload();
              }}
            />
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {!isFullMode
                ? "دسته‌بندی منطقه‌ای کاربر"
                : editingId
                  ? "ویرایش کاربر"
                  : "کاربر جدید"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-4">
            {isFullMode ? (
              <>
                <div className="space-y-2">
                  <Label>نام</Label>
                  <Input {...form.register("name")} />
                </div>
                <div className="space-y-2">
                  <Label>نام کاربری</Label>
                  <Input {...form.register("email")} dir="ltr" placeholder="BAZARBAYJAN" />
                  <p className="text-xs text-muted-foreground">فقط نام کاربری — بدون @example.com</p>
                </div>
                <ProvinceCityFields
                  province={selectedProvince ?? ""}
                  city={selectedCity ?? ""}
                  onProvinceChange={(value) => form.setValue("province", value)}
                  onCityChange={(value) => form.setValue("city", value)}
                  hideCity
                />
              </>
            ) : (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
                <p>
                  <span className="text-muted-foreground">نام: </span>
                  {form.getValues("name") || "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">نام کاربری: </span>
                  <span dir="ltr">{form.getValues("email") || "—"}</span>
                </p>
                {editingId && (
                  <p>
                    <span className="text-muted-foreground">مسئول اکانت: </span>
                    {rows.find((row) => row.id === editingId)?.accountManagerName?.trim() || "—"}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>دسته‌بندی منطقه‌ای</Label>
              <Select
                value={selectedRegion ?? NO_REGION}
                onValueChange={(value) =>
                  form.setValue("region", value === NO_REGION ? null : (value as UserRegion))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="انتخاب دسته" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_REGION}>بدون دسته</SelectItem>
                  {USER_REGIONS.map((region) => (
                    <SelectItem key={region} value={region}>
                      {userRegionLabels[region]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                فقط مدیر و کارفرما این دسته‌بندی را برای کاربر تعیین می‌کنند.
              </p>
            </div>

            {isFullMode && (
              <>
                {editingId && (
                  <div className="space-y-2">
                    <Label>مسئول اکانت</Label>
                    <Input
                      value={rows.find((row) => row.id === editingId)?.accountManagerName ?? ""}
                      disabled
                      placeholder="توسط خود کاربر در پروفایل تنظیم می‌شود"
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>{editingId ? "رمز عبور جدید (اختیاری)" : "رمز عبور"}</Label>
                  <Input type="password" {...form.register("password")} />
                </div>
                <div className="space-y-2">
                  <Label>نقش</Label>
                  <Select
                    value={selectedRole}
                    onValueChange={(value) =>
                      form.setValue("role", value as "admin" | "contributor" | "client")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contributor">کاربر (فقط داده خودش)</SelectItem>
                      <SelectItem value="client">کارفرما</SelectItem>
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

                {(selectedRole === "contributor" || selectedRole === "client") &&
                  selectedCampaignIds.length > 0 && (
                    <div className="space-y-3">
                      <Label>دسترسی به بخش‌های پنل (برای هر کمپین)</Label>
                      {selectedCampaignIds.map((campaignId) => {
                        const campaign = campaigns.find((item) => item.id === campaignId);
                        const permissions = normalizeContributorPermissions(
                          campaignPermissions[campaignId] ?? defaultContributorPermissions()
                        );
                        return (
                          <div key={campaignId} className="rounded-lg border p-3 space-y-2">
                            <p className="text-sm font-medium">{campaign?.title ?? campaignId}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {permissionKeys.map((key) => (
                                <label
                                  key={key}
                                  className="flex items-center justify-between gap-3 text-sm rounded-md border px-3 py-2"
                                >
                                  <span>{contributorPermissionLabels[key]}</span>
                                  <Switch
                                    checked={permissions[key]}
                                    onCheckedChange={(value) =>
                                      togglePermission(campaignId, key, value)
                                    }
                                  />
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
              </>
            )}

            <Button type="submit" disabled={isPending} className="w-full">
              ذخیره
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
