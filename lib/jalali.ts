const PERSIAN_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
] as const;

function isLeapGregorianYear(gy: number): boolean {
  return (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;
}

export function isLeapJalaaliYear(jy: number): boolean {
  const breaks = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262,
    2324, 2394, 2456, 3178,
  ];
  const gy = jy + 621;
  let leapJ = -14;
  let jp = breaks[0];
  let jump = 0;

  for (let i = 1; i < breaks.length; i += 1) {
    const jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ += Math.floor(jump / 33) * 8 + Math.floor((jump % 33) / 4);
    jp = jm;
  }

  const n = jy - jp;
  leapJ += Math.floor(n / 33) * 8 + Math.floor(((n % 33) + 3) / 4);
  if (jump % 33 === 4 && jump - n === 4) leapJ += 1;

  const leapG = Math.floor(gy / 4) - Math.floor((Math.floor(gy / 100) + 1) * 3 / 4) - 150;
  return leapJ - leapG === 0;
}

export function jalaaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isLeapJalaaliYear(jy) ? 30 : 29;
}

export function toJalaali(gy: number, gm: number, gd: number): { jy: number; jm: number; jd: number } {
  const gDaysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const gy2 = gy - 1600;
  const gm2 = gm - 1;
  const gd2 = gd - 1;

  let gDayNo =
    365 * gy2 +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400);

  for (let i = 0; i < gm2; i += 1) gDayNo += gDaysInMonth[i];
  if (gm2 > 1 && isLeapGregorianYear(gy)) gDayNo += 1;
  gDayNo += gd2;

  let jDayNo = gDayNo - 79;
  let jy = 979 + 33 * Math.floor(jDayNo / 12053);
  jDayNo %= 12053;
  jy += 4 * Math.floor(jDayNo / 1461);
  jDayNo %= 1461;

  if (jDayNo >= 366) {
    jy += Math.floor((jDayNo - 1) / 365);
    jDayNo = (jDayNo - 1) % 365;
  }

  let jm = 1;
  while (jm <= 12 && jDayNo >= jalaaliMonthLength(jy, jm)) {
    jDayNo -= jalaaliMonthLength(jy, jm);
    jm += 1;
  }

  return { jy, jm, jd: jDayNo + 1 };
}

export function toGregorian(jy: number, jm: number, jd: number): { gy: number; gm: number; gd: number } {
  const jy2 = jy - 979;
  let jDayNo =
    365 * jy2 +
    Math.floor(jy2 / 33) * 8 +
    Math.floor(((jy2 % 33) + 3) / 4);

  for (let i = 1; i < jm; i += 1) jDayNo += jalaaliMonthLength(jy, i);
  jDayNo += jd - 1;

  let gDayNo = jDayNo + 79;
  let gy = 1600 + 400 * Math.floor(gDayNo / 146097);
  gDayNo %= 146097;

  let leap = true;
  if (gDayNo >= 36525) {
    gDayNo -= 1;
    gy += 100 * Math.floor(gDayNo / 36524);
    gDayNo %= 36524;
    if (gDayNo >= 365) gDayNo += 1;
    else leap = false;
  }

  gy += 4 * Math.floor(gDayNo / 1461);
  gDayNo %= 1461;

  if (gDayNo >= 366) {
    leap = false;
    gy += Math.floor((gDayNo - 1) / 365);
    gDayNo = (gDayNo - 1) % 365;
  }

  const gDaysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  while (gm < 12 && gDayNo >= gDaysInMonth[gm]) {
    gDayNo -= gDaysInMonth[gm];
    gm += 1;
  }

  return { gy, gm: gm + 1, gd: gDayNo + 1 };
}

export function parseISODateLocal(dateStr: string): { y: number; m: number; d: number } {
  const [datePart] = dateStr.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  return { y, m, d };
}

export function isoFromGregorian(gy: number, gm: number, gd: number): string {
  const y = String(gy).padStart(4, "0");
  const m = String(gm).padStart(2, "0");
  const d = String(gd).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isoToJalaali(isoDate: string): { jy: number; jm: number; jd: number } {
  const { y, m, d } = parseISODateLocal(isoDate);
  return toJalaali(y, m, d);
}

export function jalaaliToISO(jy: number, jm: number, jd: number): string {
  const { gy, gm, gd } = toGregorian(jy, jm, jd);
  return isoFromGregorian(gy, gm, gd);
}

export function todayISO(): string {
  const now = new Date();
  return isoFromGregorian(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function getPersianMonthName(jm: number): string {
  return PERSIAN_MONTHS[jm - 1] ?? "";
}

export function getPersianMonthOptions(): { value: number; label: string }[] {
  return PERSIAN_MONTHS.map((label, index) => ({
    value: index + 1,
    label,
  }));
}
