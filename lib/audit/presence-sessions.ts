/** Gap after which a user is considered offline between presence pings. */
const PRESENCE_GAP_MS = 2.5 * 60 * 1000;

/** Heartbeat interval — treat the last ping as covering this window. */
const PRESENCE_TAIL_MS = 60_000;

export type PresenceSession = {
  startAt: string;
  endAt: string;
  durationSeconds: number;
};

/**
 * Cluster presence/activity timestamps into online sessions.
 * Timestamps closer than PRESENCE_GAP_MS belong to the same session.
 */
export function buildPresenceSessions(
  timestampsIso: string[],
  options?: { nowMs?: number; dayEndMs?: number }
): PresenceSession[] {
  const times = [...new Set(timestampsIso)]
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  if (times.length === 0) return [];

  const nowMs = options?.nowMs ?? Date.now();
  const dayEndMs = options?.dayEndMs ?? Number.POSITIVE_INFINITY;
  const capMs = Math.min(nowMs, dayEndMs);

  const ranges: Array<{ start: number; end: number }> = [];
  let start = times[0]!;
  let end = times[0]!;

  for (let index = 1; index < times.length; index += 1) {
    const time = times[index]!;
    if (time - end <= PRESENCE_GAP_MS) {
      end = time;
      continue;
    }
    ranges.push({ start, end: Math.min(end + PRESENCE_TAIL_MS, capMs) });
    start = time;
    end = time;
  }
  ranges.push({ start, end: Math.min(end + PRESENCE_TAIL_MS, capMs) });

  return ranges
    .map((range) => {
      const durationSeconds = Math.max(0, Math.round((range.end - range.start) / 1000));
      return {
        startAt: new Date(range.start).toISOString(),
        endAt: new Date(range.end).toISOString(),
        durationSeconds,
      };
    })
    .filter((session) => session.durationSeconds > 0);
}

export function sumSessionDurationSeconds(sessions: PresenceSession[]): number {
  return sessions.reduce((total, session) => total + session.durationSeconds, 0);
}
