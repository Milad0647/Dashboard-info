import type { AnalyticsConfig, AnalyticsSource, ChannelAnalyticsConfig, MetabaseConfig } from "@/lib/types";

const defaultChannelConfig = (): ChannelAnalyticsConfig => ({
  source: "manual",
  metabase: null,
});

export function normalizeAnalyticsConfig(raw: unknown): AnalyticsConfig {
  if (raw && typeof raw === "object" && "site" in raw) {
    const config = raw as AnalyticsConfig;
    return {
      site: {
        source: config.site?.source ?? "manual",
        metabase: config.site?.metabase ?? null,
      },
      social: {
        source: config.social?.source ?? "manual",
        metabase: config.social?.metabase ?? null,
      },
    };
  }

  const legacy = raw as { source?: AnalyticsSource; metabase?: MetabaseConfig | null } | null;
  return {
    site: {
      source: legacy?.source ?? "manual",
      metabase: legacy?.metabase ?? null,
    },
    social: defaultChannelConfig(),
  };
}

export function serializeAnalyticsConfig(config: AnalyticsConfig): AnalyticsConfig {
  return normalizeAnalyticsConfig(config);
}
