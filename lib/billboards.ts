import {
  fetchAllExternalBillboards,
  fetchCampaignIntegration,
  mapExternalBillboardToBillboard,
  mapIntegrationBillboardToBillboard,
} from "@/lib/services/billboard-api";
import type { Billboard, CampaignSettings } from "@/lib/types";

export {
  BILLBOARD_PLACEHOLDER_IMAGE,
  getBillboardDisplayImage,
  hasBillboardDisplayImage,
} from "@/lib/billboard-media";

export function isApiBillboard(billboard: Billboard): boolean {
  return (
    billboard.source === "api" ||
    billboard.id.startsWith("api-") ||
    billboard.tags.some((tag) => tag.startsWith("map:"))
  );
}

function isManualBillboard(billboard: Billboard): boolean {
  return !isApiBillboard(billboard);
}

export function getExternalCampaignSlug(settings: CampaignSettings): string | null {
  const slug = settings.billboardConfig?.externalCampaignSlug?.trim();
  return slug || null;
}

export function hasExternalBillboardConnection(settings: CampaignSettings): boolean {
  return Boolean(
    getExternalCampaignSlug(settings) || settings.billboardConfig?.externalCampaignId
  );
}

async function fetchLiveBillboards(settings: CampaignSettings): Promise<Billboard[]> {
  const integrationSlug = getExternalCampaignSlug(settings);
  if (integrationSlug) {
    const integration = await fetchCampaignIntegration(integrationSlug);
    return integration.billboards.map((item, index) =>
      mapIntegrationBillboardToBillboard(item, settings.id, {
        sortOrder: index + 1,
        published: true,
      })
    );
  }

  const externalCampaignId = settings.billboardConfig?.externalCampaignId;
  if (!externalCampaignId) {
    return [];
  }

  const externalBillboards = await fetchAllExternalBillboards(externalCampaignId);
  return externalBillboards
    .filter((item) => item.status === "active")
    .map((item, index) =>
      mapExternalBillboardToBillboard(item, settings.id, {
        sortOrder: index + 1,
        published: true,
      })
    );
}

export async function resolveAdminBillboards(
  settings: CampaignSettings,
  dbBillboards: Billboard[]
): Promise<Billboard[]> {
  const manualBillboards = dbBillboards
    .filter(isManualBillboard)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (!hasExternalBillboardConnection(settings)) {
    return manualBillboards;
  }

  try {
    const liveBillboards = await fetchLiveBillboards(settings);
    return [
      ...manualBillboards,
      ...liveBillboards.map((billboard, index) => ({
        ...billboard,
        sortOrder: manualBillboards.length + index + 1,
      })),
    ];
  } catch (error) {
    console.error("Admin billboard API fetch failed:", error);
    return manualBillboards;
  }
}

export async function resolvePublicBillboards(
  settings: CampaignSettings,
  dbBillboards: Billboard[]
): Promise<Billboard[]> {
  const manualBillboards = dbBillboards
    .filter((billboard) => billboard.published && isManualBillboard(billboard))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (!hasExternalBillboardConnection(settings)) {
    return manualBillboards;
  }

  try {
    const liveBillboards = await fetchLiveBillboards(settings);
    return [
      ...manualBillboards,
      ...liveBillboards.map((billboard, index) => ({
        ...billboard,
        sortOrder: manualBillboards.length + index + 1,
        published: true,
      })),
    ];
  } catch (error) {
    console.error("Live billboard fetch failed:", error);
    return manualBillboards;
  }
}

export function hasBillboardCoordinates(billboard: Billboard): boolean {
  return (
    typeof billboard.latitude === "number" &&
    typeof billboard.longitude === "number" &&
    Number.isFinite(billboard.latitude) &&
    Number.isFinite(billboard.longitude)
  );
}

export function shouldShowBillboardStatus(billboard: Billboard): boolean {
  return !isApiBillboard(billboard);
}

export function filterPublicBillboardTags(tags: string[]): string[] {
  return tags.filter((tag) => !tag.startsWith("map:"));
}

export function shouldShowBillboardNotes(billboard: Billboard): boolean {
  return !isApiBillboard(billboard) && Boolean(billboard.notes);
}

export function getBillboardDateLabel(billboard: Billboard): string | null {
  if (billboard.displayDateRange) return billboard.displayDateRange;
  return null;
}
