const DEFAULT_BASE_URL = "https://billboard.pixlink.ir";

export function getBillboardApiBaseUrl(): string {
  const baseUrl = process.env.BILLBOARD_API_BASE_URL ?? DEFAULT_BASE_URL;
  return baseUrl.replace(/\/$/, "");
}

export const billboardApiRoutes = {
  campaigns: () => `${getBillboardApiBaseUrl()}/api/v1/campaigns`,
  campaignIntegration: (slug: string) =>
    `${getBillboardApiBaseUrl()}/api/v1/campaigns/${encodeURIComponent(slug)}/integration`,
  billboards: (params?: { campaignId?: string; page?: number; perPage?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.campaignId) searchParams.set("campaign_id", params.campaignId);
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.perPage) searchParams.set("per_page", String(params.perPage));
    const query = searchParams.toString();
    return `${getBillboardApiBaseUrl()}/api/v1/billboards${query ? `?${query}` : ""}`;
  },
  resolveAssetUrl: (path: string | null | undefined) => {
    if (!path) return null;
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    return `${getBillboardApiBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  },
};
