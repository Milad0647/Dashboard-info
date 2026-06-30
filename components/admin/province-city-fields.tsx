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
import { getLocationCenter, resolveLocationNames } from "@/lib/iran-location-center";

interface ProvinceCityFieldsProps {
  province: string;
  city: string;
  onProvinceChange: (province: string) => void;
  onCityChange: (city: string) => void;
  onLocationCenterChange?: (center: { lat: number; lng: number }) => void;
}

const EMPTY_VALUE = "__none__";

export function ProvinceCityFields({
  province,
  city,
  onProvinceChange,
  onCityChange,
  onLocationCenterChange,
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
            const resolved = resolveLocationNames(nextProvince, "");
            onProvinceChange(resolved.province);
            onCityChange(resolved.city);
            if (resolved.province) {
              onLocationCenterChange?.(getLocationCenter(resolved.province, resolved.city));
            }
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
          onValueChange={(value) => {
            const nextCity = value === EMPTY_VALUE ? "" : value;
            onCityChange(nextCity);
            if (province && nextCity) {
              onLocationCenterChange?.(getLocationCenter(province, nextCity));
            }
          }}
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
