"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  contributorPermissionLabels,
  defaultContributorPermissions,
  type ContributorPermissionKey,
  type ContributorPermissions,
} from "@/lib/contributor-permissions";
import type { CampaignSettings } from "@/lib/types";

const permissionKeys = Object.keys(contributorPermissionLabels) as ContributorPermissionKey[];

interface UsersImportPanelProps {
  campaigns: CampaignSettings[];
  onImported: () => void;
}

export function UsersImportPanel({ campaigns, onImported }: UsersImportPanelProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [campaignIds, setCampaignIds] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<ContributorPermissions>(defaultContributorPermissions());
  const [updateExisting, setUpdateExisting] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const toggleCampaign = (campaignId: string) => {
    setCampaignIds((prev) =>
      prev.includes(campaignId) ? prev.filter((id) => id !== campaignId) : [...prev, campaignId]
    );
  };

  const togglePermission = (key: ContributorPermissionKey, value: boolean) => {
    setPermissions((prev) => ({ ...prev, [key]: value }));
  };

  const handleImport = async (file: File) => {
    if (campaignIds.length === 0) {
      toast.error("حداقل یک کمپین انتخاب کنید");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("campaignIds", JSON.stringify(campaignIds));
      formData.append("permissions", JSON.stringify(permissions));
      formData.append("updateExisting", String(updateExisting));

      const response = await fetch("/api/users/import-excel", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error ?? "ورود کاربران ناموفق بود");
        return;
      }

      toast.success(
        `ایجاد: ${result.created} | بروزرسانی: ${result.updated} | رد شده: ${result.skipped}`
      );

      if (result.errors?.length) {
        console.warn("User import errors:", result.errors);
        toast.message(`${result.errors.length} مورد با خطا مواجه شد`);
      }

      onImported();
      startTransition(() => router.refresh());
    } catch {
      toast.error("خطا در آپلود فایل");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          ورود کاربران از Excel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          ستون‌ها: نام شرکت، نام کاربری، رمز ورود. استان و شهر از روی نام شرکت به‌صورت خودکار
          پر می‌شود. نام کاربری بدون دامنه هم قابل ورود است و در سیستم به‌صورت
          {" "}
          <span dir="ltr">username@example.com</span>
          {" "}
          ذخیره می‌شود.
        </p>

        <div className="space-y-2">
          <Label>دسترسی به کمپین‌ها</Label>
          <div className="rounded-lg border p-3 space-y-2 max-h-48 overflow-y-auto">
            {campaigns.map((campaign) => (
              <label key={campaign.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={campaignIds.includes(campaign.id)}
                  onChange={() => toggleCampaign(campaign.id)}
                />
                {campaign.title}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>دسترسی به بخش‌های پنل</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {permissionKeys.map((key) => (
              <label
                key={key}
                className="flex items-center justify-between gap-3 text-sm rounded-md border px-3 py-2"
              >
                <span>{contributorPermissionLabels[key]}</span>
                <Switch
                  checked={permissions[key]}
                  onCheckedChange={(value) => togglePermission(key, value)}
                />
              </label>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <Switch checked={updateExisting} onCheckedChange={setUpdateExisting} />
          اگر کاربر وجود داشت، اطلاعات و دسترسی‌ها بروزرسانی شود
        </label>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={uploading || isPending}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            انتخاب فایل Excel
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleImport(file);
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
