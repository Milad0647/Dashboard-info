import type { DataOwnerGroup, Ownable, PublicCampaignData } from "@/lib/types";
import { normalizeStoredUserEmail } from "@/lib/auth/user-login";

export interface OwnerFilterOption {
  key: string;
  label: string;
  province?: string | null;
  city?: string | null;
  companyType?: import("./user-company-types").UserCompanyType | null;
}

function addOwnerOption(
  map: Map<string, OwnerFilterOption>,
  item: Ownable & { ownerEmail?: string | null }
): void {
  const label = item.ownerName?.trim() || "کاربر";
  const location = {
    province: item.ownerProvince?.trim() || null,
    city: item.ownerCity?.trim() || null,
    companyType: item.ownerCompanyType ?? null,
  };

  if (item.ownerUserId) {
    const existing = map.get(item.ownerUserId);
    map.set(item.ownerUserId, {
      key: item.ownerUserId,
      label,
      province: location.province ?? existing?.province ?? null,
      city: location.city ?? existing?.city ?? null,
      companyType: location.companyType ?? existing?.companyType ?? null,
    });
    return;
  }

  if (item.ownerEmail?.trim()) {
    const key = normalizeStoredUserEmail(item.ownerEmail);
    const existing = map.get(key);
    map.set(key, {
      key,
      label,
      province: location.province ?? existing?.province ?? null,
      city: location.city ?? existing?.city ?? null,
      companyType: location.companyType ?? existing?.companyType ?? null,
    });
  }
}

function collectFromGroups<T extends Ownable>(groups: DataOwnerGroup<T>[], map: Map<string, OwnerFilterOption>) {
  for (const group of groups) {
    if (!group.ownerUserId) continue;
    map.set(group.ownerUserId, {
      key: group.ownerUserId,
      label: group.ownerLabel,
      province: group.ownerProvince?.trim() || null,
      city: group.ownerCity?.trim() || null,
      companyType: group.ownerCompanyType ?? null,
    });
    for (const item of group.items) {
      addOwnerOption(map, item);
    }
  }
}

export function collectOwnerFilterOptions(data: PublicCampaignData): OwnerFilterOption[] {
  const map = new Map<string, OwnerFilterOption>();

  collectFromGroups(data.posterGroups, map);
  collectFromGroups(data.videoGroups, map);
  collectFromGroups(data.billboardGroups, map);
  collectFromGroups(data.submissionGroups, map);
  collectFromGroups(data.fileGroups, map);
  collectFromGroups(data.activityGroups, map);
  collectFromGroups(data.meetingGroups, map);
  collectFromGroups(data.socialPostGroups, map);
  collectFromGroups(data.sitePublicationGroups, map);
  collectFromGroups(data.broadcastReportGroups, map);

  for (const billboard of data.billboards) addOwnerOption(map, billboard);
  for (const poster of data.posters) addOwnerOption(map, poster);
  for (const video of data.videos) addOwnerOption(map, video);
  for (const platform of data.socialAnalytics.platforms) addOwnerOption(map, platform);

  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, "fa"));
}
