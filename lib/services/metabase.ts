import type { AnalyticsMetric, MetabaseConfig, TrafficSource, DeviceType } from "@/lib/types";

interface MetabaseRow {
  [key: string]: unknown;
}

function asNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function asString(value: unknown): string | null {
  if (value == null || value === "") return null;
  return String(value);
}

function normalizeSource(value: string | null): TrafficSource | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  const allowed: TrafficSource[] = [
    "instagram",
    "telegram",
    "direct",
    "google",
    "referral",
    "other",
  ];
  return allowed.includes(normalized as TrafficSource)
    ? (normalized as TrafficSource)
    : "other";
}

function normalizeDevice(value: string | null): DeviceType | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  const allowed: DeviceType[] = ["mobile", "desktop", "tablet"];
  return allowed.includes(normalized as DeviceType)
    ? (normalized as DeviceType)
    : null;
}

function mapMetabaseRows(rows: MetabaseRow[], campaignId: string): AnalyticsMetric[] {
  return rows.map((row, index) => ({
    id: `metabase-${index}`,
    campaignId,
    date: asString(row.date ?? row.day ?? row.created_at) ?? new Date().toISOString().split("T")[0],
    visitors: asNumber(row.visitors ?? row.visitor ?? row.sessions),
    uniqueVisitors: asNumber(row.unique_visitors ?? row.uniqueVisitors ?? row.uniques),
    pageViews: asNumber(row.page_views ?? row.pageViews ?? row.views),
    avgSessionDuration: asNumber(row.avg_session_duration ?? row.avgSessionDuration ?? row.duration),
    source: normalizeSource(asString(row.source ?? row.traffic_source)),
    device: normalizeDevice(asString(row.device)),
    page: asString(row.page ?? row.landing_page),
    city: asString(row.city ?? row.location),
    createdAt: new Date().toISOString(),
  }));
}

export async function fetchMetabaseMetrics(
  campaignId: string,
  config: MetabaseConfig
): Promise<AnalyticsMetric[]> {
  const baseUrl = config.url.replace(/\/$/, "");
  const sessionResponse = await fetch(`${baseUrl}/api/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: config.username,
      password: config.password,
    }),
    cache: "no-store",
  });

  if (!sessionResponse.ok) {
    throw new Error("Metabase authentication failed");
  }

  const sessionBody = (await sessionResponse.json().catch(() => null)) as { id?: string } | null;
  const sessionId =
    sessionBody?.id ??
    sessionResponse.headers.get("set-cookie")?.match(/metabase\.SESSION=([^;]+)/)?.[1];
  if (!sessionId) {
    throw new Error("Metabase session cookie missing");
  }

  const queryResponse = await fetch(`${baseUrl}/api/card/${config.questionId}/query/json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `metabase.SESSION=${sessionId}`,
    },
    body: JSON.stringify({}),
    cache: "no-store",
  });

  if (!queryResponse.ok) {
    throw new Error("Metabase query failed");
  }

  const rows = (await queryResponse.json()) as MetabaseRow[];
  if (!Array.isArray(rows)) {
    throw new Error("Metabase returned invalid data");
  }

  return mapMetabaseRows(rows, campaignId);
}
