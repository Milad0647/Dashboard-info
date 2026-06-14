import {
  fetchAllExternalBillboards,
  mapExternalBillboardToBillboard,
} from "@/lib/services/billboard-api";
import type { Billboard, CampaignSettings } from "@/lib/types";

function isManualBillboard(billboard: Billboard): boolean {
  return billboard.source !== "api" && !billboard.tags.some((tag) => tag.startsWith("map:"));
}

export async function resolvePublicBillboards(
  settings: CampaignSettings,
  dbBillboards: Billboard[]
): Promise<Billboard[]> {
  const manualBillboards = dbBillboards
    .filter((billboard) => billboard.published && isManualBillboard(billboard))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const externalCampaignId = settings.billboardConfig?.externalCampaignId;
  if (!externalCampaignId) {
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

export function getBillboardDisplayImage(billboard: Billboard): string {
  return billboard.imageUrl ?? billboard.thumbnailUrl;
}

export function hasBillboardCoordinates(billboard: Billboard): boolean {
  return (
    typeof billboard.latitude === "number" &&
    typeof billboard.longitude === "number" &&
    Number.isFinite(billboard.latitude) &&
    Number.isFinite(billboard.longitude)
  );
}
