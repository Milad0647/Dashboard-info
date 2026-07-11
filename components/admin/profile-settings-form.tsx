"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProvinceCityFields } from "@/components/admin/province-city-fields";
import { saveProfileAction } from "@/lib/actions/extended-actions";
import { getUserRegionLabel } from "@/lib/user-regions";
import type { UserRegion } from "@/lib/user-regions";

const schema = z.object({
  name: z.string().min(1, "نام الزامی است"),
  province: z.string().optional(),
  city: z.string().optional(),
  accountManagerName: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface ProfileSettingsFormProps {
  initialName: string;
  initialProvince?: string | null;
  initialCity?: string | null;
  initialAccountManagerName?: string | null;
  initialRegion?: UserRegion | null;
  email: string;
}

export function ProfileSettingsForm({
  initialName,
  initialProvince,
  initialCity,
  initialAccountManagerName,
  initialRegion,
  email,
}: ProfileSettingsFormProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initialName,
      province: initialProvince ?? "",
      city: initialCity ?? "",
      accountManagerName: initialAccountManagerName ?? "",
    },
  });

  const selectedProvince = form.watch("province");
  const selectedCity = form.watch("city");

  const onSubmit = (data: FormData) => {
    startTransition(async () => {
      const result = await saveProfileAction({
        name: data.name,
        province: data.province || null,
        city: data.city || null,
        accountManagerName: data.accountManagerName?.trim() || null,
      });
      if (!result.success) {
        toast.error(result.error ?? "ذخیره پروفایل ناموفق بود");
        return;
      }
      toast.success("پروفایل ذخیره شد");
    });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-w-lg">
      <div className="space-y-2">
        <Label>نام</Label>
        <Input {...form.register("name")} />
        {form.formState.errors.name && (
          <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>نام کاربری</Label>
        <Input value={email} dir="ltr" disabled />
        <p className="text-xs text-muted-foreground">نام کاربری قابل تغییر نیست.</p>
      </div>

      <div className="space-y-2">
        <Label>اسم مسئول اکانت</Label>
        <Input
          {...form.register("accountManagerName")}
          placeholder="نام مسئول اکانت خود را وارد کنید"
        />
        <p className="text-xs text-muted-foreground">
          این فیلد را خودتان تنظیم می‌کنید و در لیست کاربران برای مدیر/کارفرما نمایش داده می‌شود.
        </p>
      </div>

      <ProvinceCityFields
        province={selectedProvince ?? ""}
        city={selectedCity ?? ""}
        onProvinceChange={(value) => form.setValue("province", value)}
        onCityChange={(value) => form.setValue("city", value)}
        hideCity
      />

      <div className="space-y-2">
        <Label>دسته‌بندی منطقه‌ای</Label>
        <Input value={getUserRegionLabel(initialRegion)} disabled />
        <p className="text-xs text-muted-foreground">
          این دسته را فقط مدیر یا کارفرما برای شما تعیین می‌کند.
        </p>
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? "در حال ذخیره..." : "ذخیره پروفایل"}
      </Button>
    </form>
  );
}
