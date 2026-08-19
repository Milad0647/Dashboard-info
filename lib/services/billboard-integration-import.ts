export interface IntegrationBillboardImportResult {
  imported: number;
  updated: number;
  assignedToAdminOwner: number;
  unmatchedOwners: string[];
  matchedUsers: number;
  total: number;
}

export async function importIntegrationBillboards(_params: {
  campaignId: string;
  externalCampaignSlug: string;
  users: unknown[];
  dbBillboards: unknown[];
}): Promise<IntegrationBillboardImportResult> {
  void _params;
  return {
    imported: 0,
    updated: 0,
    assignedToAdminOwner: 0,
    unmatchedOwners: [],
    matchedUsers: 0,
    total: 0,
  };
}
