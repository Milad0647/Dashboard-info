"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowRight, Loader2, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveScoringRulesAction } from "@/lib/actions/score-actions";
import {
  SCOREABLE_CONTENT_TYPE_LABELS,
  getCategoryScoreableFields,
  getGeneralScoreableFields,
  getSelectableScoreableFields,
  type ScoreableFieldDef,
  type ScoreableFieldsContext,
} from "@/lib/scoring/scoreable-fields";
import {
  emptyScoringConfig,
  normalizeScoringRules,
} from "@/lib/scoring/normalize-scoring-rules";
import type {
  CampaignScoringConfig,
  CampaignSettings,
  CategoryScoringConfig,
  MediaCategory,
  ScoreableContentType,
  ScoringRule,
} from "@/lib/types";
import { generateId, formatPersianNumber, cn } from "@/lib/utils";

const CONTENT_TYPES = Object.keys(SCOREABLE_CONTENT_TYPE_LABELS) as ScoreableContentType[];

type HubView = "hub" | "general" | ScoreableContentType;

function findFilledPoints(rules: ScoringRule[], field: string): number {
  return rules.find((r) => r.field === field && r.kind === "filled")?.points ?? 0;
}

function upsertFilledRule(rules: ScoringRule[], field: string, points: number): ScoringRule[] {
  const next = rules.filter((r) => !(r.field === field && r.kind === "filled"));
  if (points > 0) {
    next.push({
      id: generateId(),
      field,
      kind: "filled",
      points,
    });
  }
  return next;
}

function findEqualsPoints(rules: ScoringRule[], field: string, value: string): number {
  const rule = rules.find((r) => r.field === field && r.kind === "equals" && (r.value ?? "") === value);
  return rule?.points ?? 0;
}

function upsertEqualsRule(
  rules: ScoringRule[],
  field: string,
  value: string,
  points: number
): ScoringRule[] {
  const next = rules.filter(
    (r) => !(r.field === field && r.kind === "equals" && (r.value ?? "") === value)
  );
  if (points > 0) {
    next.push({
      id: generateId(),
      field,
      kind: "equals",
      value,
      points,
    });
  }
  return next;
}

function FilledFieldsEditor({
  fields,
  rules,
  onChange,
}: {
  fields: ScoreableFieldDef[];
  rules: ScoringRule[];
  onChange: (rules: ScoringRule[]) => void;
}) {
  if (fields.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">فیلدی برای این دسته تعریف نشده است.</p>
    );
  }

  return (
    <div className={fields.length > 12 ? "max-h-96 space-y-2 overflow-y-auto pr-1" : "space-y-2"}>
      {fields.map((field) => {
        const points = findFilledPoints(rules, field.key);
        return (
          <div
            key={field.key}
            className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/80 px-3 py-2"
          >
            <span className="text-sm font-medium">{field.label}</span>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                step={1}
                className="w-24 text-left"
                dir="ltr"
                value={points || ""}
                placeholder="0"
                onChange={(e) => {
                  const n = Number(e.target.value);
                  onChange(
                    upsertFilledRule(
                      rules,
                      field.key,
                      Number.isFinite(n) && n > 0 ? n : 0
                    )
                  );
                }}
              />
              <span className="text-xs text-muted-foreground w-10">امتیاز</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OptionPointsEditor({
  field,
  rules,
  onChange,
}: {
  field: ScoreableFieldDef;
  rules: ScoringRule[];
  onChange: (rules: ScoringRule[]) => void;
}) {
  const options = field.options ?? [];
  if (options.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">گزینه‌ای برای این فیلد تعریف نشده است.</p>
    );
  }

  return (
    <div className={options.length > 12 ? "max-h-80 space-y-2 overflow-y-auto pr-1" : "space-y-2"}>
      {options.map((opt) => {
        const points = findEqualsPoints(rules, field.key, opt.value);
        return (
          <div
            key={opt.value}
            className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/80 px-3 py-2"
          >
            <span className="text-sm font-medium">{opt.label}</span>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                step={1}
                className="w-24 text-left"
                dir="ltr"
                value={points || ""}
                placeholder="0"
                onChange={(e) => {
                  const n = Number(e.target.value);
                  onChange(
                    upsertEqualsRule(
                      rules,
                      field.key,
                      opt.value,
                      Number.isFinite(n) && n > 0 ? n : 0
                    )
                  );
                }}
              />
              <span className="text-xs text-muted-foreground w-10">امتیاز</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RangePointsEditor({
  field,
  rules,
  onChange,
}: {
  field: ScoreableFieldDef;
  rules: ScoringRule[];
  onChange: (rules: ScoringRule[]) => void;
}) {
  const rangeRules = rules.filter((r) => r.field === field.key && r.kind === "range");

  const updateRule = (id: string, patch: Partial<ScoringRule>) => {
    onChange(
      rules.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
  };

  const addBand = () => {
    onChange([
      ...rules,
      {
        id: generateId(),
        field: field.key,
        kind: "range",
        min: undefined,
        max: undefined,
        points: 1,
      },
    ]);
  };

  const removeRule = (id: string) => {
    onChange(rules.filter((r) => r.id !== id));
  };

  return (
    <div className="space-y-3">
      {rangeRules.map((rule) => (
        <div
          key={rule.id}
          className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end rounded-lg border border-border/60 p-3"
        >
          <div>
            <Label className="text-xs">حداقل</Label>
            <Input
              dir="ltr"
              className="text-left"
              value={rule.min ?? ""}
              onChange={(e) =>
                updateRule(rule.id, {
                  min: e.target.value === "" ? undefined : Number(e.target.value) || e.target.value,
                })
              }
            />
          </div>
          <div>
            <Label className="text-xs">حداکثر</Label>
            <Input
              dir="ltr"
              className="text-left"
              value={rule.max ?? ""}
              onChange={(e) =>
                updateRule(rule.id, {
                  max: e.target.value === "" ? undefined : Number(e.target.value) || e.target.value,
                })
              }
            />
          </div>
          <div>
            <Label className="text-xs">امتیاز</Label>
            <Input
              type="number"
              min={0}
              dir="ltr"
              className="text-left"
              value={rule.points || ""}
              onChange={(e) => {
                const n = Number(e.target.value);
                updateRule(rule.id, { points: Number.isFinite(n) && n >= 0 ? n : 0 });
              }}
            />
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => removeRule(rule.id)}>
            حذف
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addBand}>
        افزودن بازه
      </Button>
    </div>
  );
}

function FieldBlock({
  field,
  rules,
  onChange,
}: {
  field: ScoreableFieldDef;
  rules: ScoringRule[];
  onChange: (rules: ScoringRule[]) => void;
}) {
  const hasOptions = Boolean(field.options?.length);
  const isRange = field.kinds.includes("range") && field.valueType === "number";
  const description =
    field.key === "ownerProvince"
      ? "برای هر استان یک امتیاز تعیین کنید؛ امتیاز استانِ کاربر به همه محتواهای او اضافه می‌شود."
      : field.key === "ownerRegion"
        ? "برای هر منطقه (مرکز، شمال، جنوب، شرق، غرب) یک امتیاز تعیین کنید."
        : hasOptions
          ? "برای هر گزینه یک امتیاز تعیین کنید؛ فقط گزینه انتخاب‌شده به جمع اضافه می‌شود."
          : isRange
            ? "بازه عددی تعریف کنید؛ اولین بازهٔ منطبق اعمال می‌شود."
            : "امتیاز این فیلد";

  return (
    <Card className="border-border/70 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{field.label}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {hasOptions ? (
          <OptionPointsEditor field={field} rules={rules} onChange={onChange} />
        ) : isRange ? (
          <RangePointsEditor field={field} rules={rules} onChange={onChange} />
        ) : null}
      </CardContent>
    </Card>
  );
}

interface ScoringHubProps {
  initialSettings: CampaignSettings;
  posterCategories: MediaCategory[];
  videoCategories: MediaCategory[];
}

export function ScoringHub({
  initialSettings,
  posterCategories,
  videoCategories,
}: ScoringHubProps) {
  const [config, setConfig] = useState<CampaignScoringConfig>(() =>
    normalizeScoringRules(initialSettings.scoringRules ?? emptyScoringConfig())
  );
  const [view, setView] = useState<HubView>("hub");
  const [pending, startTransition] = useTransition();

  const fieldsContext: ScoreableFieldsContext = useMemo(
    () => ({
      contentTopics: initialSettings.contentTopics,
      posterCategories,
      videoCategories,
    }),
    [initialSettings.contentTopics, posterCategories, videoCategories]
  );

  const generalFields = useMemo(
    () => getGeneralScoreableFields(fieldsContext),
    [fieldsContext]
  );

  const save = (next: CampaignScoringConfig) => {
    setConfig(next);
    startTransition(async () => {
      const result = await saveScoringRulesAction({
        campaignId: initialSettings.id,
        scoringRules: next,
        applyAndRecalculate: true,
      });
      if (!result.success) {
        toast.error(result.error ?? "ذخیره ناموفق بود");
        return;
      }
      toast.success(
        result.updated
          ? `ذخیره شد و ${formatPersianNumber(result.updated)} محتوا به‌روز شد`
          : "ذخیره شد"
      );
    });
  };

  const updateGeneral = (rules: ScoringRule[]) => {
    save({ ...config, version: 2, general: rules });
  };

  const updateCategory = (type: ScoreableContentType, cat: CategoryScoringConfig) => {
    save({
      ...config,
      version: 2,
      byType: { ...config.byType, [type]: cat },
    });
  };

  if (view === "general") {
    return (
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => setView("hub")}>
            <ArrowRight className="size-4 ml-1" />
            بازگشت
          </Button>
          <div>
            <h2 className="text-xl font-semibold">تنظیمات کلی امتیازدهی</h2>
            <p className="text-sm text-muted-foreground mt-1">
              این امتیازها برای همه دسته‌های محتوا مشترک‌اند؛ مثلاً موضوع کارت، استان کاربر و منطقه (مرکز، شمال، جنوب، شرق، غرب).
            </p>
          </div>
        </div>

        {generalFields.map((field) => (
          <FieldBlock
            key={field.key}
            field={field}
            rules={config.general}
            onChange={updateGeneral}
          />
        ))}

        {pending && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            در حال ذخیره…
          </p>
        )}
      </div>
    );
  }

  if (view !== "hub") {
    const type = view;
    const cat = config.byType[type] ?? { basePoints: 0, rules: [] };
    const selectable = getSelectableScoreableFields(type, fieldsContext);

    return (
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => setView("hub")}>
            <ArrowRight className="size-4 ml-1" />
            بازگشت
          </Button>
          <div>
            <h2 className="text-xl font-semibold">
              قوانین {SCOREABLE_CONTENT_TYPE_LABELS[type]}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              اگر هر فیلد کارت پر باشد امتیاز جدا می‌گیرد. امتیاز گزینه و بازه در ادامه، اضافه بر پر بودن است.
            </p>
          </div>
        </div>

        <Card className="border-primary/20 bg-primary/5 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">امتیاز پایه اثر</CardTitle>
            <CardDescription>
              به محض ثبت این نوع محتوا، این امتیاز به جمع اضافه می‌شود.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={0}
                dir="ltr"
                className="w-32 text-left text-lg font-semibold"
                value={cat.basePoints || ""}
                placeholder="0"
                onChange={(e) => {
                  const n = Number(e.target.value);
                  updateCategory(type, {
                    ...cat,
                    basePoints: Number.isFinite(n) && n >= 0 ? n : 0,
                  });
                }}
              />
              <span className="text-sm text-muted-foreground">امتیاز</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">اگر فیلد کارت پر باشد</CardTitle>
            <CardDescription>
              برای هر فیلد یک امتیاز تعیین کنید؛ فقط وقتی آن فیلد روی کارت پر باشد به جمع اضافه می‌شود.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FilledFieldsEditor
              fields={getCategoryScoreableFields(type, fieldsContext)}
              rules={cat.rules}
              onChange={(rules) => updateCategory(type, { ...cat, rules })}
            />
          </CardContent>
        </Card>

        {selectable.length > 0 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-semibold">امتیاز بر اساس مقدار</h3>
              <p className="text-sm text-muted-foreground mt-1">
                اختیاری است و جدا از امتیاز پر بودن فیلد حساب می‌شود؛ مثلاً انتخاب یک گزینه مشخص.
              </p>
            </div>
            {selectable.map((field) => (
              <FieldBlock
                key={field.key}
                field={field}
                rules={cat.rules}
                onChange={(rules) => updateCategory(type, { ...cat, rules })}
              />
            ))}
          </div>
        )}

        {pending && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            در حال ذخیره…
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">قوانین امتیازدهی</h1>
        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
          ابتدا تنظیمات کلی (موضوع، استان و منطقه کاربر) را مشخص کنید، سپس روی هر دسته محتوا کلیک کنید و برای هر فیلد
          کارت در صورت پر بودن امتیاز تعیین کنید. امتیاز رسمی فقط بعد از تأیید محتوا ثبت می‌شود.
        </p>
      </div>

      <button
        type="button"
        onClick={() => setView("general")}
        className={cn(
          "w-full text-right rounded-xl border-2 border-dashed border-primary/30 bg-primary/5",
          "hover:bg-primary/10 hover:border-primary/50 transition-colors p-5"
        )}
      >
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-primary/15 p-3">
            <Settings2 className="size-6 text-primary" />
          </div>
          <div className="flex-1 space-y-1">
            <p className="font-semibold text-lg">تنظیمات کلی</p>
            <p className="text-sm text-muted-foreground">
              موضوع، استان و منطقه کاربر — {formatPersianNumber(config.general.length)} قانون فعال
            </p>
          </div>
        </div>
      </button>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {CONTENT_TYPES.map((type) => {
          const cat = config.byType[type];
          const base = cat?.basePoints ?? 0;
          const ruleCount = cat?.rules.length ?? 0;
          return (
            <button
              key={type}
              type="button"
              onClick={() => setView(type)}
              className={cn(
                "text-right rounded-xl border border-border bg-card",
                "hover:border-primary/40 hover:bg-muted/40 transition-colors p-4"
              )}
            >
              <p className="font-semibold">{SCOREABLE_CONTENT_TYPE_LABELS[type]}</p>
              <p className="text-xs text-muted-foreground mt-2">
                پایه: {formatPersianNumber(base)} · فیلدها: {formatPersianNumber(ruleCount)}
              </p>
            </button>
          );
        })}
      </div>

      {pending && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          در حال ذخیره…
        </p>
      )}
    </div>
  );
}
