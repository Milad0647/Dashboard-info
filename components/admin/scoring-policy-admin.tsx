"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { saveScoringPolicyAction } from "@/lib/actions/score-actions";
import {
  computeBillboardPolicyScore,
  normalizeScoringPolicy,
  type CampaignScoringPolicy,
  type ScoringAreaRange,
  type ScoringAudienceRange,
  type ScoringCoeffRow,
  type ScoringCompanyCoeff,
} from "@/lib/scoring/scoring-policy";
import type { CampaignSettings } from "@/lib/types";
import { generateId, formatPersianNumber } from "@/lib/utils";

type PolicyTab = "billboard" | "poster_video" | "social" | "company";

interface ScoringPolicyAdminProps {
  initialSettings: CampaignSettings;
}

function CoeffTable({
  title,
  hint,
  rows,
  onChange,
  keyPlaceholder = "کلید",
}: {
  title: string;
  hint?: string;
  rows: ScoringCoeffRow[];
  onChange: (rows: ScoringCoeffRow[]) => void;
  keyPlaceholder?: string;
}) {
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div>
        <p className="text-sm font-medium">{title}</p>
        {hint ? <p className="text-xs text-muted-foreground mt-0.5">{hint}</p> : null}
      </div>
      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={row.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_6rem_auto] items-end">
            <div>
              <Label className="text-xs">کلید</Label>
              <Input
                value={row.key}
                placeholder={keyPlaceholder}
                onChange={(e) => {
                  const next = [...rows];
                  next[index] = { ...row, key: e.target.value };
                  onChange(next);
                }}
              />
            </div>
            <div>
              <Label className="text-xs">عنوان</Label>
              <Input
                value={row.label}
                onChange={(e) => {
                  const next = [...rows];
                  next[index] = { ...row, label: e.target.value };
                  onChange(next);
                }}
              />
            </div>
            <div>
              <Label className="text-xs">ضریب</Label>
              <Input
                type="number"
                min={0}
                step="any"
                dir="ltr"
                className="text-left"
                value={row.coefficient}
                onChange={(e) => {
                  const next = [...rows];
                  next[index] = {
                    ...row,
                    coefficient: Math.max(0, Number(e.target.value) || 0),
                  };
                  onChange(next);
                }}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
              aria-label="حذف"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() =>
          onChange([
            ...rows,
            { id: generateId(), key: "", label: "", coefficient: 1 },
          ])
        }
      >
        <Plus className="h-4 w-4 ml-1" />
        افزودن ردیف
      </Button>
    </div>
  );
}

function CompanyCoeffTable({
  title,
  hint,
  rows,
  onChange,
}: {
  title: string;
  hint?: string;
  rows: ScoringCompanyCoeff[];
  onChange: (rows: ScoringCompanyCoeff[]) => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div>
        <p className="text-sm font-medium">{title}</p>
        {hint ? <p className="text-xs text-muted-foreground mt-0.5">{hint}</p> : null}
      </div>
      {rows.map((row, index) => (
        <div key={row.id} className="grid gap-2 sm:grid-cols-[1fr_1fr_6rem_auto] items-end">
          <div>
            <Label className="text-xs">نام شرکت</Label>
            <Input
              value={row.label}
              onChange={(e) => {
                const next = [...rows];
                next[index] = { ...row, label: e.target.value };
                onChange(next);
              }}
            />
          </div>
          <div>
            <Label className="text-xs">شناسه کاربر (اختیاری)</Label>
            <Input
              value={row.userId ?? ""}
              dir="ltr"
              className="text-left"
              onChange={(e) => {
                const next = [...rows];
                next[index] = { ...row, userId: e.target.value.trim() || null };
                onChange(next);
              }}
            />
          </div>
          <div>
            <Label className="text-xs">ضریب</Label>
            <Input
              type="number"
              min={0}
              step="any"
              dir="ltr"
              className="text-left"
              value={row.coefficient}
              onChange={(e) => {
                const next = [...rows];
                next[index] = {
                  ...row,
                  coefficient: Math.max(0, Number(e.target.value) || 0),
                };
                onChange(next);
              }}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() =>
          onChange([
            ...rows,
            { id: generateId(), label: "", userId: null, coefficient: 1 },
          ])
        }
      >
        <Plus className="h-4 w-4 ml-1" />
        افزودن شرکت
      </Button>
    </div>
  );
}

export function ScoringPolicyAdmin({ initialSettings }: ScoringPolicyAdminProps) {
  const [policy, setPolicy] = useState<CampaignScoringPolicy>(() =>
    normalizeScoringPolicy(initialSettings.scoringPolicy)
  );
  const [tab, setTab] = useState<PolicyTab>("billboard");
  const [isPending, startTransition] = useTransition();

  const preview = useMemo(() => {
    return computeBillboardPolicyScore(
      {
        planLabels: ["قرار همدلی"],
        usesApprovedDesign: true,
        category: "billboard",
        locationType: "highway",
        areaSqm: 18,
      },
      policy
    );
  }, [policy]);

  const patch = (partial: Partial<CampaignScoringPolicy>) => {
    setPolicy((prev) => ({ ...prev, ...partial }));
  };

  const save = (applyAndRecalculate: boolean) => {
    if (applyAndRecalculate) {
      const ok = window.confirm(
        "با اعمال سیاست، امتیاز همه محتواهای این کمپین دوباره محاسبه می‌شود. ادامه می‌دهید؟"
      );
      if (!ok) return;
    }
    startTransition(async () => {
      const result = await saveScoringPolicyAction({
        campaignId: initialSettings.id,
        scoringPolicy: policy,
        applyAndRecalculate,
      });
      if (!result.success) {
        toast.error(result.error ?? "ذخیره ناموفق بود");
        return;
      }
      setPolicy(normalizeScoringPolicy(policy));
      toast.success(
        applyAndRecalculate
          ? `سیاست ذخیره و امتیاز ${formatPersianNumber(result.updated ?? 0)} محتوا به‌روز شد`
          : "سیاست امتیازدهی ذخیره شد"
      );
    });
  };

  const tabs: Array<{ id: PolicyTab; label: string }> = [
    { id: "billboard", label: "اکران محیطی" },
    { id: "poster_video", label: "پوستر و ویدیو" },
    { id: "social", label: "نشر و بازنشر" },
    { id: "company", label: "فاز و برخورداری" },
  ];

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">سیاست امتیازدهی کمپین</CardTitle>
          <div className="flex items-center gap-2">
            <Label htmlFor="policy-enabled" className="text-sm">
              فعال
            </Label>
            <Switch
              id="policy-enabled"
              checked={policy.enabled}
              onCheckedChange={(checked) => patch({ enabled: checked })}
            />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          فرمول اکران: ضریب موضوع × طرح مصوب × ارزش رسانه × محل × متراژ. سپس در صورت نیاز × ضریب فاز
          و برخورداری. همه مقادیر از همین پنل قابل تنظیم‌اند.
        </p>
        <div className="flex flex-wrap gap-2">
          {tabs.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={tab === item.id ? "default" : "outline"}
              onClick={() => setTab(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {tab === "billboard" && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3 text-sm space-y-1">
              <p className="font-medium">پیش‌نمایش نمونه (قرار همدلی × طرح مصوب × بیلبورد × بزرگراه × ۱۲–۲۴م)</p>
              <p dir="ltr" className="text-left font-mono text-xs">
                {preview.topic} × {preview.approvedDesign} × {preview.mediaValue} × {preview.location} ×{" "}
                {preview.area} = {preview.raw}
                {preview.phase !== 1 || preview.entitlement !== 1
                  ? ` → نهایی ${preview.final}`
                  : ""}
              </p>
            </div>

            <CoeffTable
              title="ضریب موضوع"
              hint="موضوع‌های خاص مثل «قرار همدلی». سایر موضوعات از ضریب پیش‌فرض استفاده می‌کنند."
              rows={policy.topicCoefficients}
              onChange={(topicCoefficients) => patch({ topicCoefficients })}
              keyPlaceholder="مثلاً قرار همدلی"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">ضریب پیش‌فرض موضوع</Label>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  dir="ltr"
                  className="text-left"
                  value={policy.defaultTopicCoefficient}
                  onChange={(e) =>
                    patch({ defaultTopicCoefficient: Math.max(0, Number(e.target.value) || 0) })
                  }
                />
              </div>
            </div>

            <CoeffTable
              title="ضریب طرح مصوب"
              hint="کلید true / false"
              rows={policy.approvedDesignCoefficients}
              onChange={(approvedDesignCoefficients) => patch({ approvedDesignCoefficients })}
            />

            <CoeffTable
              title="ضریب ارزش رسانه (نوع سازه)"
              rows={policy.mediaValueCoefficients}
              onChange={(mediaValueCoefficients) => patch({ mediaValueCoefficients })}
              keyPlaceholder="مثلاً billboard"
            />
            <div>
              <Label className="text-xs">ضریب پیش‌فرض ارزش رسانه</Label>
              <Input
                type="number"
                min={0}
                step="any"
                dir="ltr"
                className="text-left max-w-[10rem]"
                value={policy.defaultMediaValueCoefficient}
                onChange={(e) =>
                  patch({
                    defaultMediaValueCoefficient: Math.max(0, Number(e.target.value) || 0),
                  })
                }
              />
            </div>

            <CoeffTable
              title="ضریب محل"
              rows={policy.locationCoefficients}
              onChange={(locationCoefficients) => patch({ locationCoefficients })}
              keyPlaceholder="مثلاً highway"
            />
            <div>
              <Label className="text-xs">ضریب پیش‌فرض محل</Label>
              <Input
                type="number"
                min={0}
                step="any"
                dir="ltr"
                className="text-left max-w-[10rem]"
                value={policy.defaultLocationCoefficient}
                onChange={(e) =>
                  patch({
                    defaultLocationCoefficient: Math.max(0, Number(e.target.value) || 0),
                  })
                }
              />
            </div>

            <div className="space-y-2 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">بازه‌های متراژ (ضریب)</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  برای هر طیف متراژ تابلو (متر مربع) ضریب جداگانه تعیین کنید؛ مثلاً کمتر از ۱۲ → ۲،
                  ۱۲ تا ۲۴ → ۴. حدود خالی یعنی بدون حد پایین/بالا. فقط اولین بازهٔ منطبق در فرمول
                  ضرب می‌شود.
                </p>
              </div>
              {policy.areaRanges.map((row, index) => (
                <div
                  key={row.id}
                  className="grid gap-2 sm:grid-cols-[1fr_5rem_5rem_5rem_auto] items-end"
                >
                  <div>
                    <Label className="text-xs">عنوان</Label>
                    <Input
                      value={row.label}
                      onChange={(e) => {
                        const areaRanges = [...policy.areaRanges];
                        areaRanges[index] = { ...row, label: e.target.value };
                        patch({ areaRanges });
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">حداقل</Label>
                    <Input
                      type="number"
                      dir="ltr"
                      className="text-left"
                      placeholder="—"
                      value={row.min ?? ""}
                      onChange={(e) => {
                        const areaRanges = [...policy.areaRanges];
                        areaRanges[index] = {
                          ...row,
                          min: e.target.value === "" ? null : Number(e.target.value),
                        };
                        patch({ areaRanges });
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">حداکثر</Label>
                    <Input
                      type="number"
                      dir="ltr"
                      className="text-left"
                      placeholder="—"
                      value={row.max ?? ""}
                      onChange={(e) => {
                        const areaRanges = [...policy.areaRanges];
                        areaRanges[index] = {
                          ...row,
                          max: e.target.value === "" ? null : Number(e.target.value),
                        };
                        patch({ areaRanges });
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">ضریب</Label>
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      dir="ltr"
                      className="text-left"
                      value={row.coefficient}
                      onChange={(e) => {
                        const areaRanges = [...policy.areaRanges];
                        areaRanges[index] = {
                          ...row,
                          coefficient: Math.max(0, Number(e.target.value) || 0),
                        };
                        patch({ areaRanges });
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() =>
                      patch({
                        areaRanges: policy.areaRanges.filter((r) => r.id !== row.id),
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <div className="flex flex-wrap items-end gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const row: ScoringAreaRange = {
                      id: generateId(),
                      label: "بازه جدید",
                      min: null,
                      max: null,
                      coefficient: 1,
                    };
                    patch({ areaRanges: [...policy.areaRanges, row] });
                  }}
                >
                  <Plus className="h-4 w-4 ml-1" />
                  افزودن بازه متراژ
                </Button>
                <div className="max-w-[10rem]">
                  <Label className="text-xs">ضریب پیش‌فرض متراژ</Label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    dir="ltr"
                    className="text-left"
                    value={policy.defaultAreaCoefficient}
                    onChange={(e) =>
                      patch({
                        defaultAreaCoefficient: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                اگر متراژ خالی باشد یا در هیچ بازه‌ای نباشد، ضریب پیش‌فرض استفاده می‌شود.
              </p>
            </div>
          </div>
        )}

        {tab === "poster_video" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-3 rounded-lg border p-3">
              <p className="text-sm font-medium">پوستر و اینفوگرافیک</p>
              <div>
                <Label className="text-xs">امتیاز هر اثر</Label>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  dir="ltr"
                  className="text-left"
                  value={policy.poster.pointsPerItem}
                  onChange={(e) =>
                    patch({
                      poster: {
                        ...policy.poster,
                        pointsPerItem: Math.max(0, Number(e.target.value) || 0),
                      },
                    })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">سقف تعداد در روز (هر شرکت)</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  dir="ltr"
                  className="text-left"
                  value={policy.poster.dailyMaxItems}
                  onChange={(e) =>
                    patch({
                      poster: {
                        ...policy.poster,
                        dailyMaxItems: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                      },
                    })
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground">
                حداکثر امتیاز روزانه:{" "}
                {formatPersianNumber(policy.poster.pointsPerItem * policy.poster.dailyMaxItems)}
              </p>
            </div>
            <div className="space-y-3 rounded-lg border p-3">
              <p className="text-sm font-medium">ویدیو</p>
              <div>
                <Label className="text-xs">امتیاز هر ویدیو</Label>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  dir="ltr"
                  className="text-left"
                  value={policy.video.pointsPerItem}
                  onChange={(e) =>
                    patch({
                      video: {
                        ...policy.video,
                        pointsPerItem: Math.max(0, Number(e.target.value) || 0),
                      },
                    })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">سقف تعداد در روز (هر شرکت)</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  dir="ltr"
                  className="text-left"
                  value={policy.video.dailyMaxItems}
                  onChange={(e) =>
                    patch({
                      video: {
                        ...policy.video,
                        dailyMaxItems: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                      },
                    })
                  }
                />
              </div>
              <p className="text-xs text-muted-foreground">
                حداکثر امتیاز روزانه:{" "}
                {formatPersianNumber(policy.video.pointsPerItem * policy.video.dailyMaxItems)}
              </p>
            </div>
          </div>
        )}

        {tab === "social" && (
          <div className="space-y-3 rounded-lg border p-3">
            <p className="text-sm font-medium">نشر و بازنشر بر اساس تعداد مخاطب</p>
            <p className="text-xs text-muted-foreground">
              تا وقتی جدول پر نشود، امتیاز این بخش از سیاست اعمال نمی‌شود (قوانین فیلدی قدیمی همچنان
              می‌توانند استفاده شوند).
            </p>
            {policy.socialAudienceRanges.map((row, index) => (
              <div
                key={row.id}
                className="grid gap-2 sm:grid-cols-[1fr_5rem_5rem_5rem_auto] items-end"
              >
                <div>
                  <Label className="text-xs">عنوان</Label>
                  <Input
                    value={row.label}
                    onChange={(e) => {
                      const socialAudienceRanges = [...policy.socialAudienceRanges];
                      socialAudienceRanges[index] = { ...row, label: e.target.value };
                      patch({ socialAudienceRanges });
                    }}
                  />
                </div>
                <div>
                  <Label className="text-xs">حداقل</Label>
                  <Input
                    type="number"
                    dir="ltr"
                    className="text-left"
                    value={row.minAudience ?? ""}
                    onChange={(e) => {
                      const socialAudienceRanges = [...policy.socialAudienceRanges];
                      socialAudienceRanges[index] = {
                        ...row,
                        minAudience: e.target.value === "" ? null : Number(e.target.value),
                      };
                      patch({ socialAudienceRanges });
                    }}
                  />
                </div>
                <div>
                  <Label className="text-xs">حداکثر</Label>
                  <Input
                    type="number"
                    dir="ltr"
                    className="text-left"
                    value={row.maxAudience ?? ""}
                    onChange={(e) => {
                      const socialAudienceRanges = [...policy.socialAudienceRanges];
                      socialAudienceRanges[index] = {
                        ...row,
                        maxAudience: e.target.value === "" ? null : Number(e.target.value),
                      };
                      patch({ socialAudienceRanges });
                    }}
                  />
                </div>
                <div>
                  <Label className="text-xs">امتیاز</Label>
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    dir="ltr"
                    className="text-left"
                    value={row.points}
                    onChange={(e) => {
                      const socialAudienceRanges = [...policy.socialAudienceRanges];
                      socialAudienceRanges[index] = {
                        ...row,
                        points: Math.max(0, Number(e.target.value) || 0),
                      };
                      patch({ socialAudienceRanges });
                    }}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    patch({
                      socialAudienceRanges: policy.socialAudienceRanges.filter(
                        (r) => r.id !== row.id
                      ),
                    })
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                const row: ScoringAudienceRange = {
                  id: generateId(),
                  label: "بازه مخاطب",
                  minAudience: null,
                  maxAudience: null,
                  points: 0,
                };
                patch({
                  socialAudienceRanges: [...policy.socialAudienceRanges, row],
                });
              }}
            >
              <Plus className="h-4 w-4 ml-1" />
              افزودن بازه مخاطب
            </Button>
          </div>
        )}

        {tab === "company" && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">ضریب پیش‌فرض فاز</Label>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  dir="ltr"
                  className="text-left"
                  value={policy.defaultPhaseCoefficient}
                  onChange={(e) =>
                    patch({
                      defaultPhaseCoefficient: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">ضریب پیش‌فرض برخورداری</Label>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  dir="ltr"
                  className="text-left"
                  value={policy.defaultEntitlementCoefficient}
                  onChange={(e) =>
                    patch({
                      defaultEntitlementCoefficient: Math.max(0, Number(e.target.value) || 0),
                    })
                  }
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              فعلاً هر دو ضریب فقط روی بخش اکران محیطی اعمال می‌شوند (
              {policy.phaseAppliesTo.join("، ")} / {policy.entitlementAppliesTo.join("، ")}).
            </p>
            <CompanyCoeffTable
              title="ضریب پوشش فازها (هر شرکت)"
              hint="با تغییر این جدول، امتیاز اکران شرکت‌ها مجدداً محاسبه می‌شود."
              rows={policy.phaseCoefficients}
              onChange={(phaseCoefficients) => patch({ phaseCoefficients })}
            />
            <CompanyCoeffTable
              title="ضریب برخورداری شرکت"
              hint="جدول را بعداً با مقادیر رسمی پر کنید؛ تا آن زمان ضریب پیش‌فرض استفاده می‌شود."
              rows={policy.entitlementCoefficients}
              onChange={(entitlementCoefficients) => patch({ entitlementCoefficients })}
            />
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            disabled={isPending}
            onClick={() => save(false)}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : null}
            فقط ذخیره سیاست
          </Button>
          <Button type="button" disabled={isPending} onClick={() => save(true)}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : null}
            اعمال و محاسبه مجدد همه محتواها
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
