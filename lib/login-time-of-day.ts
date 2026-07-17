export type TimeOfDayPeriod = "morning" | "noon" | "evening" | "night";

export type TimeOfDayConfig = {
  period: TimeOfDayPeriod;
  label: string;
  greeting: string;
  backgroundSrc: string;
};

const PERIOD_CONFIG: Record<TimeOfDayPeriod, Omit<TimeOfDayConfig, "period">> = {
  morning: {
    label: "صبح",
    greeting: "صبح بخیر",
    backgroundSrc: "/images/login/morning.webp",
  },
  noon: {
    label: "ظهر",
    greeting: "روز بخیر",
    backgroundSrc: "/images/login/noon.webp",
  },
  evening: {
    label: "عصر",
    greeting: "عصر بخیر",
    backgroundSrc: "/images/login/evening.webp",
  },
  night: {
    label: "شب",
    greeting: "شب بخیر",
    backgroundSrc: "/images/login/night.webp",
  },
};

/** Morning 5–11, noon 12–15, evening 16–19, night 20–4 */
export function getTimeOfDayPeriod(date: Date = new Date()): TimeOfDayPeriod {
  const hour = date.getHours();

  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 16) return "noon";
  if (hour >= 16 && hour < 20) return "evening";
  return "night";
}

export function getTimeOfDayConfig(date: Date = new Date()): TimeOfDayConfig {
  const period = getTimeOfDayPeriod(date);
  return { period, ...PERIOD_CONFIG[period] };
}

export function formatPersianClock(date: Date): string {
  return new Intl.DateTimeFormat("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatPersianLoginDate(date: Date): string {
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}
