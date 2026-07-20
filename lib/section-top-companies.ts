import type {
  Billboard,
  BroadcastReport,
  CampaignActivity,
  CampaignFile,
  DataOwnerGroup,
  Ownable,
  PosterWithVersions,
  RawMediaUpload,
  SocialMediaPost,
  VideoWithVersions,
} from "@/lib/types";
import type { LeaderboardContentListItem, LeaderboardMetricLabel } from "@/lib/city-leaderboard";

export interface SectionTopCompany {
  key: string;
  name: string;
  count: number;
  scoreTotal: number;
  scoreAvg: number;
}

export type SectionTopSort = "count" | "score";

export type SectionContentKind =
  | "billboard"
  | "poster"
  | "video"
  | "social_post"
  | "site_publication"
  | "activity"
  | "file"
  | "raw_media"
  | "broadcast";

export const SECTION_CONTENT_KIND_LABEL: Record<SectionContentKind, string> = {
  billboard: "تبلیغات محیطی",
  poster: "پوستر",
  video: "ویدیو",
  social_post: "شبکه اجتماعی",
  site_publication: "انتشار سایت",
  activity: "اقدام",
  file: "فایل",
  raw_media: "راش تصویر",
  broadcast: "گزارش پخش",
};

const LEADERBOARD_METRIC_KINDS = new Set<SectionContentKind>([
  "poster",
  "video",
  "social_post",
  "site_publication",
  "activity",
  "file",
]);

export function isLeaderboardMetricKind(
  kind: SectionContentKind
): kind is Extract<
  SectionContentKind,
  "poster" | "video" | "social_post" | "site_publication" | "activity" | "file"
> {
  return LEADERBOARD_METRIC_KINDS.has(kind);
}

export function sectionKindToMetricLabel(
  kind: Extract<
    SectionContentKind,
    "poster" | "video" | "social_post" | "site_publication" | "activity" | "file"
  >
): LeaderboardMetricLabel {
  return SECTION_CONTENT_KIND_LABEL[kind] as LeaderboardMetricLabel;
}

function resolveOwnerKey(item: Ownable): { key: string; name: string } {
  const name = item.ownerName?.trim() || "شرکت";
  const key = item.ownerUserId ?? item.ownerEmail ?? name;
  return { key, name };
}

export function collectCompanyItemsFromGroups<T extends Ownable>(
  groups: DataOwnerGroup<T>[],
  companyKey: string
): T[] {
  const items: T[] = [];
  for (const group of groups) {
    for (const item of group.items) {
      if (resolveOwnerKey(item).key === companyKey) {
        items.push(item);
      }
    }
  }
  return items;
}

export function mapSectionItemsToLeaderboardContent(
  kind: Extract<
    SectionContentKind,
    "poster" | "video" | "social_post" | "site_publication" | "activity" | "file"
  >,
  items: Ownable[]
): LeaderboardContentListItem[] {
  switch (kind) {
    case "poster":
      return (items as PosterWithVersions[]).map((item) => ({ kind: "poster", item }));
    case "video":
      return (items as VideoWithVersions[]).map((item) => ({ kind: "video", item }));
    case "social_post":
      return (items as SocialMediaPost[]).map((item) => ({ kind: "social_post", item }));
    case "site_publication":
      return (items as SocialMediaPost[]).map((item) => ({ kind: "site_publication", item }));
    case "activity":
      return (items as CampaignActivity[]).map((item) => ({ kind: "activity", item }));
    case "file":
      return (items as CampaignFile[]).map((item) => ({ kind: "file", item }));
  }
}

export function asBillboardItems(items: Ownable[]): Billboard[] {
  return items as Billboard[];
}

export function asRawMediaItems(items: Ownable[]): RawMediaUpload[] {
  return items as RawMediaUpload[];
}

export function asBroadcastItems(items: Ownable[]): BroadcastReport[] {
  return items as BroadcastReport[];
}

export function buildSectionTopCompanies(
  groups: DataOwnerGroup<Ownable>[],
  sort: SectionTopSort = "count",
  limit = 5
): SectionTopCompany[] {
  const map = new Map<string, SectionTopCompany>();

  for (const group of groups) {
    for (const item of group.items) {
      const { key, name } = resolveOwnerKey(item);
      const current = map.get(key) ?? {
        key,
        name,
        count: 0,
        scoreTotal: 0,
        scoreAvg: 0,
      };
      current.count += 1;
      if (typeof item.score === "number" && Number.isFinite(item.score)) {
        current.scoreTotal += item.score;
      }
      map.set(key, current);
    }
  }

  const rows = [...map.values()].map((row) => ({
    ...row,
    scoreAvg: row.count > 0 ? row.scoreTotal / row.count : 0,
  }));

  rows.sort((a, b) => {
    if (sort === "score") {
      return b.scoreTotal - a.scoreTotal || b.count - a.count || a.name.localeCompare(b.name, "fa");
    }
    return b.count - a.count || b.scoreTotal - a.scoreTotal || a.name.localeCompare(b.name, "fa");
  });

  return rows.slice(0, limit);
}
