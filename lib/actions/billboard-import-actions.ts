"use server";

import type { ExternalBillboard, ExternalCampaign } from "@/lib/models/billboard-api";

export async function fetchExternalCampaignsAction(): Promise<{
  success: boolean;
  campaigns?: ExternalCampaign[];
  error?: string;
}> {
  return { success: false, error: "واردات از API خارجی غیرفعال شده است" };
}

export async function fetchExternalBillboardsAction(_externalCampaignId: string): Promise<{
  success: boolean;
  billboards?: ExternalBillboard[];
  error?: string;
}> {
  return { success: false, error: "واردات از API خارجی غیرفعال شده است" };
}

export async function importExternalBillboardsAction(_input: {
  campaignId: string;
  externalCampaignId: string;
  externalBillboardIds: string[];
  existingBillboards: unknown[];
  campaignEndDate?: string;
}): Promise<{
  success: boolean;
  imported: number;
  skipped: number;
  error?: string;
}> {
  return { success: false, imported: 0, skipped: 0, error: "واردات از API خارجی غیرفعال شده است" };
}
