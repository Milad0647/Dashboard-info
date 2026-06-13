"use client";

import { useMemo } from "react";
import { Control, FieldPath, FieldValues, useController } from "react-hook-form";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getPersianMonthOptions,
  isoToJalaali,
  jalaaliMonthLength,
  jalaaliToISO,
  todayISO,
} from "@/lib/jalali";
import { formatPersianNumber } from "@/lib/utils";

interface PersianDateInputProps {
  value?: string;
  onChange: (isoDate: string) => void;
  id?: string;
}

export function PersianDateInput({ value, onChange, id }: PersianDateInputProps) {
  const isoValue = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : todayISO();
  const { jy, jm, jd } = isoToJalaali(isoValue);

  const yearOptions = useMemo(() => {
    const currentYear = isoToJalaali(todayISO()).jy;
    return Array.from({ length: 21 }, (_, i) => currentYear - 10 + i);
  }, []);

  const dayOptions = useMemo(
    () => Array.from({ length: jalaaliMonthLength(jy, jm) }, (_, i) => i + 1),
    [jy, jm]
  );

  const update = (next: { jy?: number; jm?: number; jd?: number }) => {
    const nextYear = next.jy ?? jy;
    const nextMonth = next.jm ?? jm;
    const maxDay = jalaaliMonthLength(nextYear, nextMonth);
    const nextDay = Math.min(next.jd ?? jd, maxDay);
    onChange(jalaaliToISO(nextYear, nextMonth, nextDay));
  };

  return (
    <div id={id} className="grid grid-cols-3 gap-2">
      <Select value={String(jy)} onValueChange={(v) => update({ jy: Number(v) })}>
        <SelectTrigger aria-label="سال">
          <SelectValue placeholder="سال" />
        </SelectTrigger>
        <SelectContent>
          {yearOptions.map((year) => (
            <SelectItem key={year} value={String(year)}>
              {formatPersianNumber(year)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={String(jm)} onValueChange={(v) => update({ jm: Number(v) })}>
        <SelectTrigger aria-label="ماه">
          <SelectValue placeholder="ماه" />
        </SelectTrigger>
        <SelectContent>
          {getPersianMonthOptions().map((month) => (
            <SelectItem key={month.value} value={String(month.value)}>
              {month.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={String(jd)} onValueChange={(v) => update({ jd: Number(v) })}>
        <SelectTrigger aria-label="روز">
          <SelectValue placeholder="روز" />
        </SelectTrigger>
        <SelectContent>
          {dayOptions.map((day) => (
            <SelectItem key={day} value={String(day)}>
              {formatPersianNumber(day)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

interface PersianDateFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label?: string;
}

export function PersianDateField<T extends FieldValues>({
  control,
  name,
  label,
}: PersianDateFieldProps<T>) {
  const { field } = useController({ control, name });

  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      <PersianDateInput value={field.value} onChange={field.onChange} />
    </div>
  );
}
