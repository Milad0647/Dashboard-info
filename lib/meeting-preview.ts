const SUMMARY_PREVIEW_LENGTH = 120;

export function truncateMeetingSummary(text: string, maxLength = SUMMARY_PREVIEW_LENGTH): string {
  const normalized = text.trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}…`;
}
