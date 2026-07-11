import type { DataOwnerGroup, Ownable } from "@/lib/types";

export interface SectionTopCompany {
  key: string;
  name: string;
  count: number;
  scoreTotal: number;
  scoreAvg: number;
}

export type SectionTopSort = "count" | "score";

function resolveOwnerKey(item: Ownable): { key: string; name: string } {
  const name = item.ownerName?.trim() || "شرکت";
  const key = item.ownerUserId ?? item.ownerEmail ?? name;
  return { key, name };
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
