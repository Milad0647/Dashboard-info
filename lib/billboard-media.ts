import type { Billboard } from "@/lib/types";
import { isLocalUploadedImageUrl, resolveCardCoverUrl, toCardThumbnailUrl } from "@/lib/card-image";

export const BILLBOARD_PLACEHOLDER_IMAGE = "/images/billboard-placeholder.svg";

const INVALID_BILLBOARD_IMAGE_HINTS = ["via.placeholder.com", "placeholder.com"];

function normalizeBillboardImageUrl(url?: string | null): string {
  return url?.trim() ?? "";
}

function isInvalidBillboardImageUrl(url: string): boolean {
  if (!url) return true;
  if (url === BILLBOARD_PLACEHOLDER_IMAGE) return true;
  const lower = url.toLowerCase();
  return INVALID_BILLBOARD_IMAGE_HINTS.some((hint) => lower.includes(hint));
}

function firstPeriodImageUrl(billboard: Billboard): string {
  const periods = billboard.displayPeriods;
  if (!periods?.length) return "";

  const sorted = [...periods].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const period of sorted) {
    const url = normalizeBillboardImageUrl(period.billboardImageUrl);
    if (!isInvalidBillboardImageUrl(url)) return url;
  }
  return "";
}

function pickPreferredBillboardUrl(...urls: string[]): string {
  const valid = urls.filter((url) => !isInvalidBillboardImageUrl(url));
  if (!valid.length) return "";
  // Prefer local uploads over remote hosts that may be expired/unreachable in view.
  const local = valid.find((url) => isLocalUploadedImageUrl(url) || url.includes("/api/files/"));
  return local || valid[0];
}

/** Full-quality candidate for lightbox / download. */
function resolveBillboardFullImageCandidate(billboard: Billboard): string {
  const imageUrl = normalizeBillboardImageUrl(billboard.imageUrl);
  const thumbnailUrl = normalizeBillboardImageUrl(billboard.thumbnailUrl);
  const fromRow = pickPreferredBillboardUrl(imageUrl, thumbnailUrl);
  if (fromRow) return fromRow;
  return firstPeriodImageUrl(billboard);
}

/** Prefer card/thumbnail URLs for grid covers. */
function resolveBillboardCardImageCandidate(billboard: Billboard): string {
  const thumbnailUrl = normalizeBillboardImageUrl(billboard.thumbnailUrl);
  const imageUrl = normalizeBillboardImageUrl(billboard.imageUrl);
  if (!isInvalidBillboardImageUrl(thumbnailUrl)) {
    return resolveCardCoverUrl(imageUrl || thumbnailUrl, thumbnailUrl);
  }
  const fromFull = resolveBillboardFullImageCandidate(billboard);
  if (!isInvalidBillboardImageUrl(fromFull)) return toCardThumbnailUrl(fromFull);
  return "";
}

export function hasBillboardDisplayImage(billboard: Billboard): boolean {
  return !isInvalidBillboardImageUrl(resolveBillboardFullImageCandidate(billboard));
}

/** Full image for modal / download (not the low-size card thumb). */
export function getBillboardDisplayImage(billboard: Billboard): string {
  const candidate = resolveBillboardFullImageCandidate(billboard);
  if (isInvalidBillboardImageUrl(candidate)) {
    return BILLBOARD_PLACEHOLDER_IMAGE;
  }
  return candidate;
}

/** Low-size cover for cards, map pins, and admin grids. */
export function getBillboardCardImage(billboard: Billboard): string {
  const candidate = resolveBillboardCardImageCandidate(billboard);
  if (isInvalidBillboardImageUrl(candidate)) {
    return BILLBOARD_PLACEHOLDER_IMAGE;
  }
  return candidate;
}
