import type {
  ExternalBillboard,
  ExternalBillboardsResponse,
  ExternalCampaign,
  IntegrationBillboard,
} from "@/lib/models/billboard-api";
import type { Billboard } from "@/lib/types";

export async function fetchExternalCampaigns(): Promise<ExternalCampaign[]> {
  return [];
}

export async function fetchExternalBillboards(
  _campaignId: string,
  _page = 1,
  _perPage = 50
): Promise<ExternalBillboardsResponse> {
  return { data: [] };
}

export async function fetchAllExternalBillboards(_campaignId: string): Promise<ExternalBillboard[]> {
  return [];
}

export async function fetchCampaignIntegration(_slug: string) {
  return { campaign: null as never, billboards: [] as IntegrationBillboard[], meta: { billboards_count: 0, generated_at: "" } };
}

export interface IntegrationBillboardMappingOptions {
  sortOrder?: number;
  published?: boolean;
  matchedUser?: unknown;
  source?: Billboard["source"];
}

export function mapIntegrationBillboardToBillboard(
  _external: IntegrationBillboard,
  _campaignId: string,
  _options?: IntegrationBillboardMappingOptions
): Billboard {
  throw new Error("External billboard API is disabled");
}

export function mapExternalBillboardToLocal(
  _external: ExternalBillboard,
  _campaignId: string,
  _options?: { date?: string; sortOrder?: number; published?: boolean }
): Partial<Billboard> & { campaignId: string } {
  throw new Error("External billboard API is disabled");
}

export function mapExternalBillboardToBillboard(
  _external: ExternalBillboard,
  _campaignId: string,
  _options?: { date?: string; sortOrder?: number; published?: boolean }
): Billboard {
  throw new Error("External billboard API is disabled");
}
