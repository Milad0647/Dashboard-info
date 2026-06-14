import type { Billboard } from "@/lib/types";
import { normalizeUploadMediaUrl } from "@/lib/uploads";

export const BILLBOARD_PLACEHOLDER_IMAGE = "/images/billboard-placeholder.svg";

const INVALID_BILLBOARD_IMAGE_HINTS = ["via.placeholder.com", "placeholder.com"];

function normalizeBillboardImageUrl(url?: string | null): string {
  return normalizeUploadMediaUrl(url);
}

function isInvalidBillboardImageUrl(url: string): boolean {
  if (!url) return true;
  if (url === BILLBOARD_PLACEHOLDER_IMAGE) return true;
  const lower = url.toLowerCase();
  return INVALID_BILLBOARD_IMAGE_HINTS.some((hint) => lower.includes(hint));
}

export function hasBillboardDisplayImage(billboard: Billboard): boolean {
  const imageUrl = normalizeBillboardImageUrl(billboard.imageUrl);
  const thumbnailUrl = normalizeBillboardImageUrl(billboard.thumbnailUrl);
  const candidate = imageUrl || thumbnailUrl;
  return !isInvalidBillboardImageUrl(candidate);
}

export function getBillboardDisplayImage(billboard: Billboard): string {
  const imageUrl = normalizeBillboardImageUrl(billboard.imageUrl);
  const thumbnailUrl = normalizeBillboardImageUrl(billboard.thumbnailUrl);
  const candidate = imageUrl || thumbnailUrl;

  if (isInvalidBillboardImageUrl(candidate)) {
    return BILLBOARD_PLACEHOLDER_IMAGE;
  }

  return candidate;
}
