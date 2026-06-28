const REGIONAL_ELECTRICITY_PROVINCES: Record<string, string> = {
  آذربایجان: "آذربایجان",
  اصفهان: "اصفهان",
  باختر: "کرمانشاه",
  تهران: "تهران",
  خراسان: "خراسان رضوی",
  خوزستان: "خوزستان",
  زنجان: "زنجان",
  سمنان: "سمنان",
  "سیستان و بلوچستان": "سیستان و بلوچستان",
  غرب: "همدان",
  فارس: "فارس",
  کرمان: "کرمان",
  گیلان: "گیلان",
  مازندران: "مازندران",
  هرمزگان: "هرمزگان",
  یزد: "یزد",
};

const CITY_PROVINCE_MAP: Array<{ city: string; province: string }> = [
  { city: "تبریز", province: "آذربایجان شرقی" },
  { city: "اردبیل", province: "اردبیل" },
  { city: "اهواز", province: "خوزستان" },
  { city: "شیراز", province: "فارس" },
  { city: "مشهد", province: "خراسان رضوی" },
  { city: "قم", province: "قم" },
  { city: "قزوین", province: "قزوین" },
  { city: "بوشهر", province: "بوشهر" },
  { city: "ایلام", province: "ایلام" },
  { city: "کرمانشاه", province: "کرمانشاه" },
  { city: "کردستان", province: "کردستان" },
  { city: "لرستان", province: "لرستان" },
  { city: "همدان", province: "همدان" },
  { city: "یزد", province: "یزد" },
  { city: "زنجان", province: "زنجان" },
  { city: "سمنان", province: "سمنان" },
  { city: "گلستان", province: "گلستان" },
  { city: "گیلان", province: "گیلان" },
  { city: "مازندران", province: "مازندران" },
  { city: "هرمزگان", province: "هرمزگان" },
  { city: "اصفهان", province: "اصفهان" },
  { city: "تهران", province: "تهران" },
  { city: "البرز", province: "البرز" },
  { city: "فارس", province: "فارس" },
  { city: "خوزستان", province: "خوزستان" },
  { city: "خراسان", province: "خراسان رضوی" },
  { city: "کرمان", province: "کرمان" },
  { city: "آذربایجان شرقی", province: "آذربایجان شرقی" },
  { city: "آذربایجان غربی", province: "آذربایجان غربی" },
  { city: "چهارمحال و بختیاری", province: "چهارمحال و بختیاری" },
  { city: "کهکیلویه و بویراحمد", province: "کهکیلویه و بویراحمد" },
  { city: "سیستان و بلوچستان", province: "سیستان و بلوچستان" },
  { city: "خراسان شمالی", province: "خراسان شمالی" },
  { city: "خراسان جنوبی", province: "خراسان جنوبی" },
  { city: "خراسان رضوی", province: "خراسان رضوی" },
  { city: "مرکزی", province: "مرکزی" },
];

function normalizeCompanyName(name: string): string {
  return name.replace(/\u200c/g, " ").replace(/\s+/g, " ").trim();
}

function matchCityProvince(name: string): { province: string; city: string | null } | null {
  const sorted = [...CITY_PROVINCE_MAP].sort((a, b) => b.city.length - a.city.length);
  for (const entry of sorted) {
    if (name.includes(entry.city)) {
      const isProvinceOnly = entry.city === entry.province;
      return {
        province: entry.province,
        city: isProvinceOnly ? null : entry.city,
      };
    }
  }
  return null;
}

export function parseCompanyLocation(companyName: string): {
  province: string | null;
  city: string | null;
} {
  const name = normalizeCompanyName(companyName);
  if (!name) {
    return { province: null, city: null };
  }

  if (name.includes("مدیریت شبکه")) {
    return { province: "تهران", city: "تهران" };
  }

  const provinceMatch = name.match(/استان\s+([\u0600-\u06FF\s]+?)(?:\s{2,}|$)/);
  if (provinceMatch) {
    const province = normalizeCompanyName(provinceMatch[1]);
    const cityMatch = matchCityProvince(name);
    return {
      province,
      city: cityMatch?.city ?? null,
    };
  }

  const regionalMatch = name.match(/برق\s*منطقه\s*ای\s+(.+)$/);
  if (regionalMatch) {
    const region = normalizeCompanyName(regionalMatch[1]);
    const province = REGIONAL_ELECTRICITY_PROVINCES[region] ?? region;
    return { province, city: null };
  }

  const cityMatch = matchCityProvince(name);
  if (cityMatch) {
    return cityMatch;
  }

  return { province: null, city: null };
}
