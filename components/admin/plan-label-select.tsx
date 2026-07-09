"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NO_PLAN = "__none__";

interface PlanLabelSelectProps {
  plans: string[];
  value?: string | null;
  onChange: (value: string | null) => void;
  label?: string;
  optional?: boolean;
}

export function PlanLabelSelect({
  plans,
  value,
  onChange,
  label = "طرح",
  optional = true,
}: PlanLabelSelectProps) {
  if (plans.length === 0) return null;

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select
        value={value?.trim() ? value : optional ? NO_PLAN : plans[0]}
        onValueChange={(next) => onChange(next === NO_PLAN ? null : next)}
      >
        <SelectTrigger>
          <SelectValue placeholder="انتخاب طرح" />
        </SelectTrigger>
        <SelectContent>
          {optional && <SelectItem value={NO_PLAN}>بدون طرح</SelectItem>}
          {plans.map((plan) => (
            <SelectItem key={plan} value={plan}>
              {plan}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
