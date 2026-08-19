export function getBillboardApiBaseUrl(): string {
  return "";
}

export const billboardApiRoutes = {
  campaigns: () => "",
  campaignIntegration: (_slug: string) => "",
  billboards: (_params?: { campaignId?: string; page?: number; perPage?: number }) => "",
  createBillboard: () => "",
  authLogin: () => "",
  campaignBillboards: (_campaignId: string) => "",
  campaignBillboardDesigns: (_campaignId: string, _assignmentId: string) => "",
  resolveAssetUrl: (path: string | null | undefined) => {
    if (!path) return null;
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    if (path.startsWith("/")) return path;
    return `/${path}`;
  },
};
