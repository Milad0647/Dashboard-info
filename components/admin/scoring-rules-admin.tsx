"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveScoringRulesAction } from "@/lib/actions/score-actions";
import {
  SCOREABLE_CONTENT_TYPE_LABELS,
  getScoreableField,
  getScoreableFields,
  type ScoreableFieldDef,
} from "@/lib/scoring/scoreable-fields";
import { normalizeScoringRules } from "@/lib/scoring/normalize-scoring-rules";
import type {
  CampaignScoringRules,
  CampaignSettings,
  ScoreableContentType,
  ScoringRule,
  ScoringRuleKind,
} from "@/lib/types";
import { generateId } from "@/lib/utils";

const CONTENT_TYPES = Object.keys(SCOREABLE_CONTENT_TYPE_LABELS) as ScoreableContentType[];

function fieldHasOptions(field: ScoreableFieldDef | undefined): boolean {
  return Boolean(field?.options && field.options.length > 0);
}

/** Unique field keys currently used in rules (preserves first-seen order). */
function usedFieldKeys(rules: ScoringRule[]): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const rule of rules) {
    if (seen.has(rule.field)) continue;
    seen.add(rule.field);
    keys.push(rule.field);
  }
  return keys;
}

function rulesForField(rules: ScoringRule[], fieldKey: string): ScoringRule[] {
  return rules.filter((r) => r.field === fieldKey);
}

function findFilledRule(rules: ScoringRule[]): ScoringRule | undefined {
  return rules.find((r) => r.kind === "filled");
}

function findEqualsRule(rules: ScoringRule[], value: string): ScoringRule | undefined {
  return rules.find((r) => r.kind === "equals" && (r.value ?? "") === value);
}

function findRangeRule(rules: ScoringRule[]): ScoringRule | undefined {
  return rules.find((r) => r.kind === "range");
}

interface ScoringRulesAdminProps {
  initialSettings: CampaignSettings;
}

export function ScoringRulesAdmin({ initialSettings }: ScoringRulesAdminProps) {
  const [rulesByType, setRulesByType] = useState<CampaignScoringRules>(() =>
    normalizeScoringRules(initialSettings.scoringRules ?? {})
  );
  const [activeType, setActiveType] = useState<ScoreableContentType>("billboard");
  const [fieldToAdd, setFieldToAdd] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const activeRules = useMemo(
    () => rulesByType[activeType] ?? [],
    [rulesByType, activeType]
  );
  const fields = useMemo(() => getScoreableFields(activeType), [activeType]);
  const fieldKeys = useMemo(() => usedFieldKeys(activeRules), [activeRules]);
  const availableFields = useMemo(
    () => fields.filter((f) => !fieldKeys.includes(f.key)),
    [fields, fieldKeys]
  );

  const updateRules = (next: ScoringRule[]) => {
    setRulesByType((prev) => ({
      ...prev,
      [activeType]: next,
    }));
  };

  const replaceFieldRules = (fieldKey: string, nextFieldRules: ScoringRule[]) => {
    const others = activeRules.filter((r) => r.field !== fieldKey);
    updateRules([...others, ...nextFieldRules]);
  };

  const removeField = (fieldKey: string) => {
    updateRules(activeRules.filter((r) => r.field !== fieldKey));
  };

  const addField = (fieldKey: string) => {
    if (!fieldKey || fieldKeys.includes(fieldKey)) return;
    const fieldDef = getScoreableField(activeType, fieldKey);
    if (!fieldDef) return;

    if (fieldHasOptions(fieldDef)) {
      // One equals rule per option (points start at 0 — ignored until set).
      const optionRules: ScoringRule[] = (fieldDef.options ?? []).map((option) => ({
        id: generateId(),
        field: fieldKey,
        kind: "equals" as const,
        value: option.value,
        points: 0,
      }));
      updateRules([...activeRules, ...optionRules]);
    } else if (fieldDef.kinds.includes("range") && !fieldDef.kinds.includes("filled")) {
      updateRules([
        ...activeRules,
        {
          id: generateId(),
          field: fieldKey,
          kind: "range",
          points: 1,
        },
      ]);
    } else {
      const kind: ScoringRuleKind = fieldDef.kinds.includes("filled")
        ? "filled"
        : fieldDef.kinds[0] ?? "filled";
      updateRules([
        ...activeRules,
        {
          id: generateId(),
          field: fieldKey,
          kind,
          points: 1,
        },
      ]);
    }
    setFieldToAdd("");
  };

  const setFilledPoints = (fieldKey: string, points: number) => {
    const fieldRules = rulesForField(activeRules, fieldKey);
    const existing = findFilledRule(fieldRules);
    const withoutFilled = fieldRules.filter((r) => r.kind !== "filled");
    if (points <= 0) {
      replaceFieldRules(fieldKey, withoutFilled);
      return;
    }
    replaceFieldRules(fieldKey, [
      ...withoutFilled,
      existing
        ? { ...existing, points }
        : { id: generateId(), field: fieldKey, kind: "filled", points },
    ]);
  };

  const setOptionPoints = (fieldKey: string, optionValue: string, points: number) => {
    const fieldRules = rulesForField(activeRules, fieldKey);
    const safePoints = Math.max(0, points);
    const existing = findEqualsRule(fieldRules, optionValue);
    const others = fieldRules.filter(
      (r) => !(r.kind === "equals" && (r.value ?? "") === optionValue)
    );
    replaceFieldRules(fieldKey, [
      ...others,
      existing
        ? { ...existing, points: safePoints }
        : {
            id: generateId(),
            field: fieldKey,
            kind: "equals",
            value: optionValue,
            points: safePoints,
          },
    ]);
  };

  const patchEqualsTextRule = (
    fieldKey: string,
    ruleId: string,
    patch: Partial<Pick<ScoringRule, "value" | "points">>
  ) => {
    const fieldRules = rulesForField(activeRules, fieldKey);
    replaceFieldRules(
      fieldKey,
      fieldRules.map((rule) => (rule.id === ruleId ? { ...rule, ...patch } : rule))
    );
  };

  const addEqualsTextRule = (fieldKey: string) => {
    const fieldRules = rulesForField(activeRules, fieldKey);
    replaceFieldRules(fieldKey, [
      ...fieldRules,
      {
        id: generateId(),
        field: fieldKey,
        kind: "equals",
        value: "",
        points: 1,
      },
    ]);
  };

  const removeEqualsTextRule = (fieldKey: string, ruleId: string) => {
    const fieldRules = rulesForField(activeRules, fieldKey);
    const next = fieldRules.filter((r) => r.id !== ruleId);
    if (next.length === 0) {
      replaceFieldRules(fieldKey, [
        { id: generateId(), field: fieldKey, kind: "equals", value: "", points: 1 },
      ]);
      return;
    }
    replaceFieldRules(fieldKey, next);
  };

  const setRangePatch = (
    fieldKey: string,
    patch: Partial<Pick<ScoringRule, "min" | "max" | "points">>
  ) => {
    const fieldRules = rulesForField(activeRules, fieldKey);
    const existing = findRangeRule(fieldRules);
    const others = fieldRules.filter((r) => r.kind !== "range");
    replaceFieldRules(fieldKey, [
      ...others,
      existing
        ? { ...existing, ...patch }
        : {
            id: generateId(),
            field: fieldKey,
            kind: "range",
            points: 1,
            ...patch,
          },
    ]);
  };

  const setRuleKindMode = (fieldKey: string, kind: ScoringRuleKind) => {
    const fieldDef = getScoreableField(activeType, fieldKey);
    if (!fieldDef || fieldHasOptions(fieldDef)) return;

    const fieldRules = rulesForField(activeRules, fieldKey);
    const prevPoints =
      findFilledRule(fieldRules)?.points ??
      findRangeRule(fieldRules)?.points ??
      fieldRules.find((r) => r.kind === "equals")?.points ??
      1;

    if (kind === "filled") {
      replaceFieldRules(fieldKey, [
        { id: generateId(), field: fieldKey, kind: "filled", points: prevPoints },
      ]);
      return;
    }
    if (kind === "equals") {
      replaceFieldRules(fieldKey, [
        {
          id: generateId(),
          field: fieldKey,
          kind: "equals",
          value: "",
          points: prevPoints,
        },
      ]);
      return;
    }
    replaceFieldRules(fieldKey, [
      { id: generateId(), field: fieldKey, kind: "range", points: prevPoints },
    ]);
  };

  const save = (applyAndRecalculate: boolean) => {
    if (applyAndRecalculate) {
      const confirmed = window.confirm(
        "با اعمال قوانین، امتیاز همه محتواهای این کمپین دوباره محاسبه می‌شود و امتیاز دستی قبلی پاک می‌گردد. ادامه می‌دهید؟"
      );
      if (!confirmed) return;
    }

    startTransition(async () => {
      // Drop zero-point equals rows so storage stays clean (UI still shows all options).
      const cleaned: CampaignScoringRules = {};
      for (const type of CONTENT_TYPES) {
        const list = rulesByType[type] ?? [];
        const kept = list.filter((rule) => {
          if (rule.kind === "equals" && rule.points <= 0) return false;
          return true;
        });
        if (kept.length > 0) cleaned[type] = kept;
      }

      const result = await saveScoringRulesAction({
        campaignId: initialSettings.id,
        scoringRules: cleaned,
        applyAndRecalculate,
      });
      if (!result.success) {
        toast.error(result.error ?? "ذخیره قوانین ناموفق بود");
        return;
      }
      setRulesByType(cleaned);
      if (applyAndRecalculate) {
        toast.success(`قوانین ذخیره و امتیاز ${result.updated ?? 0} محتوا محاسبه شد`);
      } else {
        toast.success("قوانین ذخیره شد");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">قوانین امتیازدهی خودکار</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          فیلد را انتخاب کنید و امتیاز بدهید. برای فیلدهای انتخابی (مثل دسته‌بندی) به هر گزینه امتیاز
          جدا بدهید؛ برای فیلدهای متنی فقط بر اساس پر بودن امتیاز می‌گیرد. امتیاز نهایی کارت = خودکار +
          دستی.
        </p>

        <div>
          <Label>نوع محتوا</Label>
          <Select
            value={activeType}
            onValueChange={(value) => {
              setActiveType(value as ScoreableContentType);
              setFieldToAdd("");
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONTENT_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {SCOREABLE_CONTENT_TYPE_LABELS[type]}
                  {(rulesByType[type]?.length ?? 0) > 0
                    ? ` (${usedFieldKeys(rulesByType[type] ?? []).length} فیلد)`
                    : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          {fieldKeys.length === 0 && (
            <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-3">
              هنوز فیلدی برای امتیازدهی انتخاب نشده است.
            </p>
          )}

          {fieldKeys.map((fieldKey) => {
            const fieldDef = getScoreableField(activeType, fieldKey) ?? fields[0];
            const fieldRules = rulesForField(activeRules, fieldKey);
            const hasOptions = fieldHasOptions(fieldDef);
            const filledRule = findFilledRule(fieldRules);
            const rangeRule = findRangeRule(fieldRules);
            const equalsTextRules = fieldRules.filter((r) => r.kind === "equals");
            const activeKind: ScoringRuleKind = hasOptions
              ? "equals"
              : filledRule
                ? "filled"
                : rangeRule
                  ? "range"
                  : equalsTextRules.length > 0
                    ? "equals"
                    : fieldDef?.kinds[0] ?? "filled";
            const allowedKinds = fieldDef?.kinds ?? ["filled"];

            return (
              <div
                key={fieldKey}
                className="space-y-3 rounded-lg border p-3 bg-muted/20"
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <Label className="text-xs text-muted-foreground">فیلد</Label>
                    <p className="text-sm font-medium">{fieldDef?.label ?? fieldKey}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => removeField(fieldKey)}
                    aria-label="حذف فیلد"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {hasOptions ? (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      برای هر گزینه امتیاز جداگانه تعیین کنید. مقدار ۰ یعنی امتیازی برای آن گزینه
                      نیست.
                    </p>
                    <div className="space-y-2">
                      {(fieldDef?.options ?? []).map((option) => {
                        const rule = findEqualsRule(fieldRules, option.value);
                        return (
                          <div
                            key={option.value}
                            className="flex items-center gap-3 rounded-md border bg-background/60 px-3 py-2"
                          >
                            <span className="flex-1 text-sm min-w-0 truncate">
                              {option.label}
                            </span>
                            <div className="w-28 shrink-0">
                              <Input
                                type="number"
                                min={0}
                                step="any"
                                value={rule?.points ?? 0}
                                onChange={(event) =>
                                  setOptionPoints(
                                    fieldKey,
                                    option.value,
                                    Math.max(0, Number(event.target.value) || 0)
                                  )
                                }
                                dir="ltr"
                                className="text-left h-8"
                                aria-label={`امتیاز ${option.label}`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {allowedKinds.includes("filled") && (
                      <div className="flex items-center gap-3 rounded-md border border-dashed px-3 py-2">
                        <span className="flex-1 text-sm text-muted-foreground">
                          امتیاز اضافه اگر فیلد پر باشد (هر گزینه‌ای)
                        </span>
                        <div className="w-28 shrink-0">
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            value={filledRule?.points ?? 0}
                            onChange={(event) =>
                              setFilledPoints(
                                fieldKey,
                                Math.max(0, Number(event.target.value) || 0)
                              )
                            }
                            dir="ltr"
                            className="text-left h-8"
                            aria-label="امتیاز پر بودن"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {allowedKinds.length > 1 && (
                      <div>
                        <Label className="text-xs">نوع امتیاز</Label>
                        <Select
                          value={activeKind}
                          onValueChange={(value) =>
                            setRuleKindMode(fieldKey, value as ScoringRuleKind)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {allowedKinds.map((kind) => (
                              <SelectItem key={kind} value={kind}>
                                {kind === "filled"
                                  ? "فیلد پر باشد"
                                  : kind === "equals"
                                    ? "مقدار برابر باشد"
                                    : "در بازه باشد"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {activeKind === "filled" && (
                      <div>
                        <Label className="text-xs">امتیاز اگر فیلد پر باشد</Label>
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          value={filledRule?.points ?? 0}
                          onChange={(event) =>
                            setFilledPoints(
                              fieldKey,
                              Math.max(0, Number(event.target.value) || 0)
                            )
                          }
                          dir="ltr"
                          className="text-left"
                        />
                      </div>
                    )}

                    {activeKind === "equals" && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          اگر مقدار فیلد با یکی از این‌ها برابر باشد، امتیاز همان ردیف اعمال می‌شود.
                        </p>
                        {equalsTextRules.map((rule) => (
                          <div key={rule.id} className="flex items-end gap-2">
                            <div className="flex-1 min-w-0">
                              <Label className="text-xs">مقدار</Label>
                              <Input
                                value={rule.value ?? ""}
                                onChange={(event) =>
                                  patchEqualsTextRule(fieldKey, rule.id, {
                                    value: event.target.value,
                                  })
                                }
                                placeholder="مثلاً نام شهر یا استان"
                              />
                            </div>
                            <div className="w-28 shrink-0">
                              <Label className="text-xs">امتیاز</Label>
                              <Input
                                type="number"
                                min={0}
                                step="any"
                                value={rule.points}
                                onChange={(event) =>
                                  patchEqualsTextRule(fieldKey, rule.id, {
                                    points: Math.max(0, Number(event.target.value) || 0),
                                  })
                                }
                                dir="ltr"
                                className="text-left"
                              />
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={() => removeEqualsTextRule(fieldKey, rule.id)}
                              aria-label="حذف مقدار"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => addEqualsTextRule(fieldKey)}
                        >
                          <Plus className="h-4 w-4 ml-1" />
                          افزودن مقدار دیگر
                        </Button>
                      </div>
                    )}

                    {activeKind === "range" && (
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div>
                          <Label className="text-xs">حداقل</Label>
                          <Input
                            type={fieldDef?.valueType === "date" ? "date" : "number"}
                            value={rangeRule?.min ?? ""}
                            onChange={(event) =>
                              setRangePatch(fieldKey, {
                                min:
                                  fieldDef?.valueType === "date"
                                    ? event.target.value
                                    : event.target.value === ""
                                      ? undefined
                                      : Number(event.target.value),
                              })
                            }
                            dir="ltr"
                            className="text-left"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">حداکثر</Label>
                          <Input
                            type={fieldDef?.valueType === "date" ? "date" : "number"}
                            value={rangeRule?.max ?? ""}
                            onChange={(event) =>
                              setRangePatch(fieldKey, {
                                max:
                                  fieldDef?.valueType === "date"
                                    ? event.target.value
                                    : event.target.value === ""
                                      ? undefined
                                      : Number(event.target.value),
                              })
                            }
                            dir="ltr"
                            className="text-left"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">امتیاز</Label>
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            value={rangeRule?.points ?? 0}
                            onChange={(event) =>
                              setRangePatch(fieldKey, {
                                points: Math.max(0, Number(event.target.value) || 0),
                              })
                            }
                            dir="ltr"
                            className="text-left"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[180px]">
            <Label className="text-xs">افزودن فیلد برای امتیازدهی</Label>
            <Select
              value={fieldToAdd || undefined}
              onValueChange={setFieldToAdd}
              disabled={availableFields.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    availableFields.length === 0
                      ? "همه فیلدها اضافه شده‌اند"
                      : "انتخاب فیلد"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {availableFields.map((field) => (
                  <SelectItem key={field.key} value={field.key}>
                    {field.label}
                    {fieldHasOptions(field) ? " (گزینه‌ای)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => addField(fieldToAdd)}
            disabled={isPending || !fieldToAdd}
          >
            <Plus className="h-4 w-4 ml-1" />
            افزودن
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => save(false)}
            disabled={isPending}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : null}
            فقط ذخیره قوانین
          </Button>
          <Button type="button" onClick={() => save(true)} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin ml-1" /> : null}
            اعمال و محاسبه مجدد همه محتواها
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
