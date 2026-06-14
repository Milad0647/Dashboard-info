"use client";

import { useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Control, FieldPath, FieldValues, useController } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  getPersianMonthName,
  isoToJalaali,
  jalaaliMonthLength,
  jalaaliToISO,
  todayISO,
} from "@/lib/jalali";
import { cn, formatPersianNumber } from "@/lib/utils";

interface PersianDateInputProps {
  value?: string;
  onChange: (isoDate: string) => void;
  id?: string;
}

export function PersianDateInput({ value, onChange, id }: PersianDateInputProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const isoValue = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : todayISO();
  const selected = isoToJalaali(isoValue);
  const [viewYear, setViewYear] = useState(selected.jy);
  const [viewMonth, setViewMonth] = useState(selected.jm);

  const displayLabel = useMemo(() => {
    return `${formatPersianNumber(selected.jd)} ${getPersianMonthName(selected.jm)} ${formatPersianNumber(selected.jy)}`;
  }, [selected.jd, selected.jm, selected.jy]);

  const dayOptions = useMemo(
    () => Array.from({ length: jalaaliMonthLength(viewYear, viewMonth) }, (_, index) => index + 1),
    [viewYear, viewMonth]
  );

  const selectDay = (day: number) => {
    onChange(jalaaliToISO(viewYear, viewMonth, day));
    setOpen(false);
  };

  const goToPreviousMonth = () => {
    if (viewMonth === 1) {
      setViewYear((year) => year - 1);
      setViewMonth(12);
      return;
    }
    setViewMonth((month) => month - 1);
  };

  const goToNextMonth = () => {
    if (viewMonth === 12) {
      setViewYear((year) => year + 1);
      setViewMonth(1);
      return;
    }
    setViewMonth((month) => month + 1);
  };

  return (
    <div id={id} ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        className="w-full justify-between font-normal"
        onClick={() => {
          setViewYear(selected.jy);
          setViewMonth(selected.jm);
          setOpen((current) => !current);
        }}
      >
        <span>{displayLabel}</span>
        <CalendarDays className="h-4 w-4 text-muted-foreground" />
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full z-50 mt-2 w-full min-w-[280px] rounded-xl border bg-card p-3 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <Button type="button" variant="ghost" size="icon" onClick={goToPreviousMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <div className="text-sm font-medium">
                {getPersianMonthName(viewMonth)} {formatPersianNumber(viewYear)}
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={goToNextMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
              {["ش", "ی", "د", "س", "چ", "پ", "ج"].map((label) => (
                <span key={label} className="py-1">{label}</span>
              ))}
            </div>

            <div className="mt-1 grid grid-cols-7 gap-1">
              {dayOptions.map((day) => {
                const isSelected =
                  day === selected.jd &&
                  viewMonth === selected.jm &&
                  viewYear === selected.jy;

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => selectDay(day)}
                    className={cn(
                      "rounded-md py-2 text-sm transition-colors hover:bg-accent",
                      isSelected && "bg-primary text-primary-foreground hover:bg-primary"
                    )}
                  >
                    {formatPersianNumber(day)}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
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
