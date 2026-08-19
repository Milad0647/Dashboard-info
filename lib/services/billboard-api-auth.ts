export function clearBillboardApiTokenCache(): void {
  // no-op: external API disabled
}

export async function resolveBillboardApiToken(_options?: {
  forceRefresh?: boolean;
}): Promise<string> {
  throw new Error("اتصال به API خارجی بیلبورد غیرفعال شده است");
}

export async function formatBillboardApiError(_response: Response, _rawBody: string): Promise<string> {
  return "API خارجی بیلبورد غیرفعال شده است";
}

export async function isMapBilboardApiReady(): Promise<boolean> {
  return false;
}
