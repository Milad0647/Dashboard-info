"use server";

import type { MapBilboardApiSettingsPublic } from "@/lib/types";

export async function getMapBilboardSettingsAction(): Promise<MapBilboardApiSettingsPublic | null> {
  return null;
}

export async function saveMapBilboardSettingsAction(_data: {
  baseUrl?: string;
  email?: string;
  password?: string;
  token?: string;
}) {
  return { success: false, error: "اتصال به API خارجی غیرفعال شده است" };
}

export async function testMapBilboardConnectionAction() {
  return { success: false, error: "اتصال به API خارجی غیرفعال شده است" };
}
