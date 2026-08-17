import type { Billboard } from "@/lib/types";
import { isLocalUploadedImageUrl, resolveCardCoverUrl, toCardThumbnailUrl } from "@/lib/card-image";

export const BILLBOARD_PLACEHOLDER_IMAGE = "/images/billboard-placeholder.svg";

const INVALID_BILLBOARD_IMAGE_HINTS = ["via.placeholder.com", "placeholder.com"];

function normalizeBillboardImageUrl(url?: string | null): string {
  const trimmed = url?.trim() ?? "";
  if (!trimmed) return "";
  if (
    trimmed.startsWith("http://") &&
    !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(trimmed)
  ) {
    return `https://${trimmed.slice("http://".length)}`;
  }
  return trimmed;
}

function isInvalidBillboardImageUrl(url: string): boolean {
  if (!url) return true;
  if (url === BILLBOARD_PLACEHOLDER_IMAGE) return true;
  const lower = url.toLowerCase();
  return INVALID_BILLBOARD_IMAGE_HINTS.some((hint) => lower.includes(hint));
}

function isLocalBillboardFileUrl(url: string): boolean {
  return isLocalUploadedImageUrl(url) || url.includes("/api/files/");
}

function collectBillboardImageUrls(billboard: Billboard): string[] {
  const urls: string[] = [];
  const add = (url?: string | null) => {
    const normalized = normalizeBillboardImageUrl(url);
    if (!isInvalidBillboardImageUrl(normalized)) urls.push(normalized);
  };

  add(billboard.imageUrl);
  add(billboard.thumbnailUrl);

  const periods = [...(billboard.displayPeriods ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const period of periods) {
    add(period.billboardImageUrl);
  }

  return urls;
}

function pickPreferredBillboardUrl(urls: string[]): string {
  const valid = urls.filter((url) => !isInvalidBillboardImageUrl(url));
  if (!valid.length) return "";
  // Prefer local uploads over remote hosts that may be expired/unreachable in view.
  const local = valid.find((url) => isLocalBillboardFileUrl(url));
  return local || valid[0];
}

/** Full-quality candidate for lightbox / download. */
function resolveBillboardFullImageCandidate(billboard: Billboard): string {
  return pickPreferredBillboardUrl(collectBillboardImageUrls(billboard));
}

/** Prefer card/thumbnail URLs for grid covers. */
function resolveBillboardCardImageCandidate(billboard: Billboard): string {
  const fromFull = resolveBillboardFullImageCandidate(billboard);
  if (isInvalidBillboardImageUrl(fromFull)) return "";

  const thumbnailUrl = normalizeBillboardImageUrl(billboard.thumbnailUrl);
  if (!isInvalidBillboardImageUrl(thumbnailUrl) && isLocalBillboardFileUrl(thumbnailUrl)) {
    return resolveCardCoverUrl(fromFull, thumbnailUrl);
  }

  return toCardThumbnailUrl(fromFull);
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
