import { getLocationCenter } from "@/lib/iran-location-center";

export function getCityCoordinates(
  city?: string | null,
  province?: string | null
): [number, number] {
  const center = getLocationCenter(province ?? "", city);
  return [center.lat, center.lng];
}
