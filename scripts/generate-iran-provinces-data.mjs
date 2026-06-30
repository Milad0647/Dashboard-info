/**
 * Generates lib/iran-provinces-data.ts from lib/data/iran-city-centers.json
 * Source of truth: Map-Bilboard iran-cities-coordinates.json (copy into lib/data/)
 * Run: node scripts/generate-iran-provinces-data.mjs
 */
import fs from "node:fs";
import path from "node:path";

const flatPath = path.join("lib", "data", "iran-city-centers.json");
const outPath = path.join("lib", "iran-provinces-data.ts");

const flat = JSON.parse(fs.readFileSync(flatPath, "utf8"));
const provincesMap = new Map();

for (const entry of Object.values(flat)) {
  const { province, city, lat, lng } = entry;
  if (!provincesMap.has(province)) {
    provincesMap.set(province, []);
  }
  provincesMap.get(province).push({ name: city, lat, lng });
}

const provinces = [...provincesMap.entries()]
  .sort(([a], [b]) => a.localeCompare(b, "fa"))
  .map(([name, cities]) => ({
    name,
    cities: cities.sort((a, b) => a.name.localeCompare(b.name, "fa")),
  }));

const output = `// Auto-generated — do not edit manually
// Regenerate: node scripts/generate-iran-provinces-data.mjs

export interface IranCity {
  name: string;
  lat: number;
  lng: number;
}

export interface IranProvince {
  name: string;
  cities: IranCity[];
}

export const IRAN_PROVINCES_DATA: IranProvince[] = ${JSON.stringify(provinces, null, 2)};
`;

fs.writeFileSync(outPath, output);
console.log(`Wrote ${provinces.length} provinces to ${outPath}`);
