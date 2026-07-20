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

const KIND_LABELS: Record<ScoringRuleKind, string> = {
  filled: "فیلد پر باشد",
  equals: "مقدار برابر باشد",
  range: "در بازه باشد",
};

function emptyRule(contentType: ScoreableContentType): ScoringRule {
  const fields = getScoreableFields(contentType);
  const field = fields[0]?.key ?? "title";
  const kinds = fields[0]?.kinds ?? ["filled"];
  return {
    id: generateId(),
    field,
    kind: kinds[0] ?? "filled",
    points: 1,
  };
}

interface ScoringRulesAdminProps {
  initialSettings: CampaignSettings;
}

export function ScoringRulesAdmin({ initialSettings }: ScoringRulesAdminProps) {
  const [rulesByType, setRulesByType] = useState<CampaignScoringRules>(() =>
    normalizeScoringRules(initialSettings.scoringRules ?? {})
  );
  const [activeType, setActiveType] = useState<ScoreableContentType>("billboard");
  const [isPending, startTransition] = useTransition();

  const activeRules = rulesByType[activeType] ?? [];
  const fields = useMemo(() => getScoreableFields(activeType), [activeType]);

  const updateRules = (next: ScoringRule[]) => {
    setRulesByType((prev) => ({
      ...prev,
      [activeType]: next,
    }));
  };

  const addRule = () => {
    updateRules([...activeRules, emptyRule(activeType)]);
  };

  const removeRule = (ruleId: string) => {
    updateRules(activeRules.filter((r) => r.id !== ruleId));
  };

  const patchRule = (ruleId: string, patch: Partial<ScoringRule>) => {
    updateRules(
      activeRules.map((rule) => {
        if (rule.id !== ruleId) return rule;
        const next = { ...rule, ...patch };
        if (patch.field) {
          const fieldDef = getScoreableField(activeType, patch.field);
          if (fieldDef && !fieldDef.kinds.includes(next.kind)) {
            next.kind = fieldDef.kinds[0] ?? "filled";
          }
        }
        return next;
      })
    );
  };

  const save = (applyAndRecalculate: boolean) => {
    if (applyAndRecalculate) {
      const confirmed = window.confirm(
        "با اعمال قوانین، امتیاز همه محتواهای این کمپین دوباره محاسبه می‌شود و امتیاز دستی قبلی پاک می‌گردد. ادامه می‌دهید؟"
      );
      if (!confirmed) return;
    }

    startTransition(async () => {
      const result = await saveScoringRulesAction({
        campaignId: initialSettings.id,
        scoringRules: rulesByType,
        applyAndRecalculate,
      });
      if (!result.success) {
        toast.error(result.error ?? "ذخیره قوانین ناموفق بود");
        return;
      }
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
          برای هر نوع محتوا قوانین جدا تعریف کنید. امتیاز نهایی هر کارت = امتیاز خودکار (از قوانین) + امتیاز
          دستی اضافه.
        </p>

        <div>
          <Label>نوع محتوا</Label>
          <Select
            value={activeType}
            onValueChange={(value) => setActiveType(value as ScoreableContentType)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONTENT_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {SCOREABLE_CONTENT_TYPE_LABELS[type]}
                  {(rulesByType[type]?.length ?? 0) > 0
                    ? ` (${rulesByType[type]!.length})`
                    : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          {activeRules.length === 0 && (
            <p className="text-sm text-muted-foreground rounded-lg border border-dashed p-3">
              هنوز قانونی برای این نوع محتوا تعریف نشده است.
            </p>
          )}

          {activeRules.map((rule) => {
            const fieldDef = getScoreableField(activeType, rule.field) ?? fields[0];
            const allowedKinds = fieldDef?.kinds ?? ["filled"];
            return (
              <div
                key={rule.id}
                className="space-y-3 rounded-lg border p-3 bg-muted/20"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs">فیلد</Label>
                    <Select
                      value={rule.field}
                      onValueChange={(value) => patchRule(rule.id, { field: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {fields.map((field) => (
                          <SelectItem key={field.key} value={field.key}>
                            {field.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">نوع قانون</Label>
                    <Select
                      value={rule.kind}
                      onValueChange={(value) =>
                        patchRule(rule.id, { kind: value as ScoringRuleKind })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {allowedKinds.map((kind) => (
                          <SelectItem key={kind} value={kind}>
                            {KIND_LABELS[kind]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {rule.kind === "equals" && (
                  <div>
                    <Label className="text-xs">مقدار</Label>
                    {fieldDef?.options && fieldDef.options.length > 0 ? (
                      <Select
                        value={rule.value ?? ""}
                        onValueChange={(value) => patchRule(rule.id, { value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="انتخاب مقدار" />
                        </SelectTrigger>
                        <SelectContent>
                          {fieldDef.options.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={rule.value ?? ""}
                        onChange={(event) =>
                          patchRule(rule.id, { value: event.target.value })
                        }
                        placeholder="مقدار مورد نظر"
                      />
                    )}
                  </div>
                )}

                {rule.kind === "range" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs">حداقل</Label>
                      <Input
                        type={fieldDef?.valueType === "date" ? "date" : "number"}
                        value={rule.min ?? ""}
                        onChange={(event) =>
                          patchRule(rule.id, {
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
                        value={rule.max ?? ""}
                        onChange={(event) =>
                          patchRule(rule.id, {
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
                  </div>
                )}

                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label className="text-xs">امتیاز</Label>
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      value={rule.points}
                      onChange={(event) =>
                        patchRule(rule.id, {
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
                    onClick={() => removeRule(rule.id)}
                    aria-label="حذف قانون"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={addRule} disabled={isPending}>
            <Plus className="h-4 w-4 ml-1" />
            افزودن قانون
          </Button>
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
