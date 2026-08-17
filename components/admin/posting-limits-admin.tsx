"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveDailyPostingLimitsAction } from "@/lib/actions/posting-limits-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  getPostingLimitCategoryLabel,
  normalizeDailyPostingLimits,
  POSTING_LIMIT_COMPANY_TYPE_KEYS,
  POSTING_LIMIT_REGION_KEYS,
  UNCATEGORIZED_POSTING_LIMIT_KEY,
  type CategoryDailyLimit,
  type DailyPostingLimitsConfig,
  type PostingLimitCategoryKey,
} from "@/lib/posting-limits";
import type { CampaignSettings } from "@/lib/types";

interface PostingLimitsAdminProps {
  initialSettings: CampaignSettings;
}

function CategoryRows({
  keys,
  config,
  disabled,
  onChange,
}: {
  keys: PostingLimitCategoryKey[];
  config: DailyPostingLimitsConfig;
  disabled: boolean;
  onChange: (key: PostingLimitCategoryKey, next: CategoryDailyLimit) => void;
}) {
  return (
    <div className="space-y-2">
      {keys.map((key) => {
        const row = config.byCategory[key] ?? { enabled: false, dailyMax: 5 };
        return (
          <div
            key={key}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/80 px-3 py-2.5"
          >
            <div className="flex items-center gap-3 min-w-[10rem]">
              <Switch
                checked={row.enabled}
                disabled={disabled}
                onCheckedChange={(enabled) => onChange(key, { ...row, enabled })}
              />
              <span className="text-sm font-medium">{getPostingLimitCategoryLabel(key)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                step={1}
                dir="ltr"
                disabled={disabled || !row.enabled}
                className="w-24 text-left"
                value={row.dailyMax || ""}
                placeholder="0"
                onChange={(e) => {
                  const n = Number(e.target.value);
                  onChange(key, {
                    ...row,
                    dailyMax: Number.isFinite(n) && n > 0 ? Math.floor(n) : 0,
                  });
                }}
              />
              <span className="text-xs text-muted-foreground w-16">محتوا / روز</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function PostingLimitsAdmin({ initialSettings }: PostingLimitsAdminProps) {
  const [config, setConfig] = useState<DailyPostingLimitsConfig>(() =>
    normalizeDailyPostingLimits(initialSettings.dailyPostingLimits)
  );
  const [pending, startTransition] = useTransition();

  const updateCategory = (key: PostingLimitCategoryKey, next: CategoryDailyLimit) => {
    setConfig((prev) => ({
      ...prev,
      byCategory: { ...prev.byCategory, [key]: next },
    }));
  };

  const save = () => {
    startTransition(async () => {
      const result = await saveDailyPostingLimitsAction({
        campaignId: initialSettings.id,
        config,
      });
      if (!result.success) {
        toast.error(result.error ?? "ذخیره ناموفق بود");
        return;
      }
      toast.success("محدودیت روزانه ذخیره شد");
    });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">محدودیت بارگذاری روزانه</h1>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          برای هر دسته‌بندی کاربر مشخص کنید در هر روز چند محتوا می‌تواند ثبت کند. محدودیت را می‌توان برای کل
          کمپین یا برای هر دسته جداگانه فعال و غیرفعال کرد. این بخش فقط برای مدیر و کارفرما در دسترس است.
        </p>
      </div>

      <Card className="border-primary/20 bg-primary/5 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">فعال‌سازی محدودیت</CardTitle>
          <CardDescription>
            تا وقتی این گزینه خاموش باشد، هیچ سقفی برای کاربران اعمال نمی‌شود.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <label className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">محدودیت روزانه</p>
              <p className="text-xs text-muted-foreground mt-1">
                سقف روی مجموع محتواهای ثبت‌شده در همان روز (به وقت تهران) حساب می‌شود.
              </p>
            </div>
            <Switch
              checked={config.enabled}
              onCheckedChange={(enabled) => setConfig((prev) => ({ ...prev, enabled }))}
            />
          </label>
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">دسته‌بندی منطقه‌ای</CardTitle>
          <CardDescription>
            اگر کاربر هم منطقه و هم نوع شرکت داشته باشد و هر دو فعال باشند، سقف سخت‌گیرانه‌تر اعمال می‌شود.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CategoryRows
            keys={POSTING_LIMIT_REGION_KEYS}
            config={config}
            disabled={!config.enabled}
            onChange={updateCategory}
          />
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">نوع شرکت</CardTitle>
          <CardDescription>سقف جدا برای شرکت توزیع و برق منطقه‌ای.</CardDescription>
        </CardHeader>
        <CardContent>
          <CategoryRows
            keys={POSTING_LIMIT_COMPANY_TYPE_KEYS}
            config={config}
            disabled={!config.enabled}
            onChange={updateCategory}
          />
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">کاربران بدون دسته‌بندی</CardTitle>
          <CardDescription>
            فقط وقتی اعمال می‌شود که کاربر نه منطقه داشته باشد و نه نوع شرکت.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CategoryRows
            keys={[UNCATEGORIZED_POSTING_LIMIT_KEY]}
            config={config}
            disabled={!config.enabled}
            onChange={updateCategory}
          />
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="button" onClick={save} disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin ml-1" />}
          ذخیره محدودیت‌ها
        </Button>
        {pending && <span className="text-sm text-muted-foreground">در حال ذخیره…</span>}
      </div>
    </div>
  );
}
