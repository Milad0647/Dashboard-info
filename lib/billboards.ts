import {
  fetchAllExternalBillboards,
  mapExternalBillboardToBillboard,
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

function isLiveBillboardSyncEnabled(): boolean {
  return process.env.BILLBOARD_LIVE_SYNC !== "false";
}

export function getManualPublishedBillboards(dbBillboards: Billboard[]): Billboard[] {
  return dbBillboards
    .filter((billboard) => billboard.published && isManualBillboard(billboard))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function resolveAdminBillboards(
  settings: CampaignSettings,
  dbBillboards: Billboard[]
): Promise<Billboard[]> {
  const manualBillboards = dbBillboards
    .filter(isManualBillboard)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const externalCampaignId = settings.billboardConfig?.externalCampaignId;
  if (!externalCampaignId || !isLiveBillboardSyncEnabled()) {
    return manualBillboards;
  }

  try {
    const externalBillboards = await fetchAllExternalBillboards(externalCampaignId);
    const liveBillboards = externalBillboards.map((item, index) =>
      mapExternalBillboardToBillboard(item, settings.id, {
        sortOrder: manualBillboards.length + index + 1,
        published: item.status === "active",
      })
    );

    return [...manualBillboards, ...liveBillboards];
  } catch (error) {
    console.error("Admin billboard API fetch failed:", error);
    return manualBillboards;
  }
}

export async function resolvePublicBillboards(
  settings: CampaignSettings,
  dbBillboards: Billboard[]
): Promise<Billboard[]> {
  const manualBillboards = getManualPublishedBillboards(dbBillboards);

  const externalCampaignId = settings.billboardConfig?.externalCampaignId;
  if (!externalCampaignId || !isLiveBillboardSyncEnabled()) {
    return manualBillboards;
  }

  try {
    const externalBillboards = await fetchAllExternalBillboards(externalCampaignId);
    const liveBillboards = externalBillboards
      .filter((item) => item.status === "active")
      .map((item, index) =>
        mapExternalBillboardToBillboard(item, settings.id, {
          sortOrder: manualBillboards.length + index + 1,
          published: true,
        })
      );

    return [...manualBillboards, ...liveBillboards];
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
