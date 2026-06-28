"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ensureSelectOptions,
  getCitiesForProvince,
  IRAN_PROVINCES,
} from "@/lib/iran-locations";

interface ProvinceCityFieldsProps {
  province: string;
  city: string;
  onProvinceChange: (province: string) => void;
  onCityChange: (city: string) => void;
}

const EMPTY_VALUE = "__none__";

export function ProvinceCityFields({
  province,
  city,
  onProvinceChange,
  onCityChange,
}: ProvinceCityFieldsProps) {
  const provinceOptions = ensureSelectOptions([...IRAN_PROVINCES], province);
  const cityOptions = ensureSelectOptions(getCitiesForProvince(province), city);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="space-y-2">
        <Label>استان</Label>
        <Select
          value={province || EMPTY_VALUE}
          onValueChange={(value) => {
            const nextProvince = value === EMPTY_VALUE ? "" : value;
            onProvinceChange(nextProvince);
            onCityChange("");
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="انتخاب استان" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={EMPTY_VALUE}>انتخاب نشده</SelectItem>
            {provinceOptions.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>شهر</Label>
        <Select
          value={city || EMPTY_VALUE}
          onValueChange={(value) => onCityChange(value === EMPTY_VALUE ? "" : value)}
          disabled={!province}
        >
          <SelectTrigger>
            <SelectValue placeholder={province ? "انتخاب شهر" : "ابتدا استان را انتخاب کنید"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={EMPTY_VALUE}>انتخاب نشده</SelectItem>
            {cityOptions.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
