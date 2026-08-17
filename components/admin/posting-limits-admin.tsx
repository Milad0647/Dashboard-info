"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveDailyPostingLimitsAction } from "@/lib/actions/posting-limits-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  createDefaultCategoryDailyLimit,
  getPostingLimitCategoryLabel,
  normalizeDailyPostingLimits,
  POSTING_LIMIT_COMPANY_TYPE_KEYS,
  POSTING_LIMIT_CONTENT_TYPE_LABELS,
  POSTING_LIMIT_CONTENT_TYPES,
  POSTING_LIMIT_PROVINCE_KEYS,
  POSTING_LIMIT_REGION_KEYS,
  UNCATEGORIZED_POSTING_LIMIT_KEY,
  type CategoryDailyLimit,
  type DailyPostingLimitsConfig,
  type PostingLimitCategoryKey,
} from "@/lib/posting-limits";
import { getUserCompanyTypeLabel, type UserCompanyType } from "@/lib/user-company-types";
import type { CampaignSettings, ScoreableContentType } from "@/lib/types";

export interface PostingLimitCompany {
  id: string;
  name: string;
  province: string | null;
  companyType: UserCompanyType | null;
}

interface PostingLimitsAdminProps {
  initialSettings: CampaignSettings;
  companies: PostingLimitCompany[];
}

function LimitRow({
  label,
  hint,
  row,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  row: CategoryDailyLimit;
  disabled: boolean;
  onChange: (next: CategoryDailyLimit) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/80 px-3 py-2.5">
      <div className="flex items-center gap-3 min-w-[10rem]">
        <Switch
          checked={row.enabled}
          disabled={disabled}
          onCheckedChange={(enabled) => onChange({ ...row, enabled })}
        />
        <div>
          <p className="text-sm font-medium">{label}</p>
          {hint ? <p className="text-xs text-muted-foreground mt-0.5">{hint}</p> : null}
        </div>
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
            onChange({
              ...row,
              dailyMax: Number.isFinite(n) && n > 0 ? Math.floor(n) : 0,
            });
          }}
        />
        <span className="text-xs text-muted-foreground w-16">محتوا / روز</span>
      </div>
    </div>
  );
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
      {keys.map((key) => (
        <LimitRow
          key={key}
          label={getPostingLimitCategoryLabel(key)}
          row={config.byCategory[key] ?? createDefaultCategoryDailyLimit()}
          disabled={disabled}
          onChange={(next) => onChange(key, next)}
        />
      ))}
    </div>
  );
}

export function PostingLimitsAdmin({
  initialSettings,
  companies,
}: PostingLimitsAdminProps) {
  const [config, setConfig] = useState<DailyPostingLimitsConfig>(() =>
    normalizeDailyPostingLimits(initialSettings.dailyPostingLimits)
  );
  const [provinceQuery, setProvinceQuery] = useState("");
  const [companyQuery, setCompanyQuery] = useState("");
  const [pending, startTransition] = useTransition();

  const updateCategory = (key: PostingLimitCategoryKey, next: CategoryDailyLimit) => {
    setConfig((prev) => ({
      ...prev,
      byCategory: { ...prev.byCategory, [key]: next },
    }));
  };

  const updateProvince = (province: string, next: CategoryDailyLimit) => {
    setConfig((prev) => ({
      ...prev,
      byProvince: { ...prev.byProvince, [province]: next },
    }));
  };

  const updateCompany = (userId: string, next: CategoryDailyLimit) => {
    setConfig((prev) => ({
      ...prev,
      byCompany: { ...prev.byCompany, [userId]: next },
    }));
  };

  const updateContentType = (type: ScoreableContentType, next: CategoryDailyLimit) => {
    setConfig((prev) => ({
      ...prev,
      byContentType: { ...prev.byContentType, [type]: next },
    }));
  };

  const filteredProvinces = useMemo(() => {
    const q = provinceQuery.trim();
    if (!q) return POSTING_LIMIT_PROVINCE_KEYS;
    return POSTING_LIMIT_PROVINCE_KEYS.filter((name) => name.includes(q));
  }, [provinceQuery]);

  const sortedCompanies = useMemo(() => {
    const q = companyQuery.trim();
    const list = [...companies].sort((a, b) => a.name.localeCompare(b.name, "fa"));
    if (!q) return list;
    return list.filter((company) => {
      const typeLabel = getUserCompanyTypeLabel(company.companyType);
      return (
        company.name.includes(q) ||
        (company.province ?? "").includes(q) ||
        typeLabel.includes(q)
      );
    });
  }, [companies, companyQuery]);

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
          برای هر دسته محتوا (تبلیغات محیطی، پوستر، ویدیو و بقیه)، و همچنین منطقه، استان، نوع شرکت یا خود شرکت،
          مشخص کنید در هر روز چند مورد می‌تواند ثبت شود. سقف اختصاصی هر شرکت، اگر فعال باشد، بر سقف مجموع
          دسته‌های کاربر اولویت دارد؛ سقف هر نوع محتوا جداگانه حساب می‌شود.
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
                سقف مجموع و سقف هر نوع محتوا، هر دو روی ثبت همان روز (به وقت تهران) اعمال می‌شوند.
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
          <CardTitle className="text-base">دسته محتوا</CardTitle>
          <CardDescription>
            سقف جدا برای هر نوع محتوا؛ مثلاً چند تبلیغات محیطی، پوستر یا ویدیو در روز. این سقف مستقل از سقف
            مجموع کاربر است.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {POSTING_LIMIT_CONTENT_TYPES.map((type) => (
            <LimitRow
              key={type}
              label={POSTING_LIMIT_CONTENT_TYPE_LABELS[type]}
              row={config.byContentType[type] ?? createDefaultCategoryDailyLimit()}
              disabled={!config.enabled}
              onChange={(next) => updateContentType(type, next)}
            />
          ))}
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">دسته‌بندی منطقه‌ای</CardTitle>
          <CardDescription>
            اگر چند دسته فعال باشد، سقف سخت‌گیرانه‌تر اعمال می‌شود؛ مگر اینکه برای خود شرکت سقف جدا گذاشته باشید.
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
          <CardTitle className="text-base">استان</CardTitle>
          <CardDescription>سقف روزانه بر اساس استان کاربر.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={provinceQuery}
            onChange={(e) => setProvinceQuery(e.target.value)}
            placeholder="جستجوی استان..."
          />
          <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
            {filteredProvinces.length === 0 ? (
              <p className="text-sm text-muted-foreground">استانی پیدا نشد.</p>
            ) : (
              filteredProvinces.map((province) => (
                <LimitRow
                  key={province}
                  label={province}
                  row={config.byProvince[province] ?? createDefaultCategoryDailyLimit()}
                  disabled={!config.enabled}
                  onChange={(next) => updateProvince(province, next)}
                />
              ))
            )}
          </div>
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
          <CardTitle className="text-base">بر اساس شرکت</CardTitle>
          <CardDescription>
            سقف اختصاصی هر شرکت روی بقیه دسته‌ها اولویت دارد. فقط شرکت‌های همین کمپین نمایش داده می‌شوند.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={companyQuery}
            onChange={(e) => setCompanyQuery(e.target.value)}
            placeholder="جستجوی نام شرکت، استان یا نوع..."
          />
          {sortedCompanies.length === 0 ? (
            <p className="text-sm text-muted-foreground">شرکتی برای این کمپین پیدا نشد.</p>
          ) : (
            <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
              {sortedCompanies.map((company) => {
                const hint = [company.province, getUserCompanyTypeLabel(company.companyType)]
                  .filter((part) => part && part !== "—")
                  .join(" · ");
                return (
                  <LimitRow
                    key={company.id}
                    label={company.name}
                    hint={hint || undefined}
                    row={config.byCompany[company.id] ?? createDefaultCategoryDailyLimit()}
                    disabled={!config.enabled}
                    onChange={(next) => updateCompany(company.id, next)}
                  />
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border/70 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">کاربران بدون دسته‌بندی</CardTitle>
          <CardDescription>
            فقط وقتی اعمال می‌شود که کاربر استان، منطقه و نوع شرکت نداشته باشد و سقف اختصاصی شرکت هم نداشته باشد.
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
