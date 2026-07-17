/**
 * Legacy helpers kept so old sessionStorage entries are cleared on visit.
 * Meeting unlock details must stay in React state only (not browser storage).
 */

function storageKey(campaignSlug: string) {
  return `campaign-meetings-unlocked:${campaignSlug}`;
}

export function clearUnlockedMeetings(campaignSlug: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(storageKey(campaignSlug));
  } catch {
    // Ignore storage access errors (private mode / blocked storage).
  }
}
