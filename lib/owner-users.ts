import type { DataOwnerGroup, Ownable, PublicCampaignData } from "@/lib/types";
import { normalizeStoredUserEmail } from "@/lib/auth/user-login";

export interface OwnerFilterOption {
  key: string;
  label: string;
}

function addOwnerOption(
  map: Map<string, string>,
  item: Ownable & { ownerEmail?: string | null }
): void {
  const label = item.ownerName?.trim() || "کاربر";
  if (item.ownerUserId) {
    map.set(item.ownerUserId, label);
    return;
  }
  if (item.ownerEmail?.trim()) {
    map.set(normalizeStoredUserEmail(item.ownerEmail), label);
  }
}

function collectFromGroups<T extends Ownable>(groups: DataOwnerGroup<T>[], map: Map<string, string>) {
  for (const group of groups) {
    if (!group.ownerUserId) continue;
    map.set(group.ownerUserId, group.ownerLabel);
    for (const item of group.items) {
      addOwnerOption(map, item);
    }
  }
}

export function collectOwnerFilterOptions(data: PublicCampaignData): OwnerFilterOption[] {
  const map = new Map<string, string>();

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

  return [...map.entries()]
    .map(([key, label]) => ({ key, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "fa"));
}
