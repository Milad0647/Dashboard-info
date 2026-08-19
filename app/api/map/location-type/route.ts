import { NextResponse } from "next/server";
import {
  inferBillboardLocationType,
  isBillboardLocationTypeKey,
  type BillboardLocationTypeKey,
} from "@/lib/billboard-location-types";
import { consumeRateLimit, getRequestClientIp } from "@/lib/security/rate-limit";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";
const FETCH_TIMEOUT_MS = 8_000;

interface NominatimReverse {
  category?: string;
  type?: string;
  addresstype?: string;
  name?: string;
  display_name?: string;
  address?: {
    road?: string;
    amenity?: string;
    suburb?: string;
    neighbourhood?: string;
  };
}

function parseCoord(raw: string | null): number | null {
  if (!raw) return null;
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : null;
}

export async function GET(request: Request) {
  const ip = getRequestClientIp(request);
  const limit = consumeRateLimit(`map-location-type:${ip}`, {
    limit: 20,
    windowMs: 10_000,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } }
    );
  }

  const { searchParams } = new URL(request.url);
  const latitude = parseCoord(searchParams.get("lat"));
  const longitude = parseCoord(searchParams.get("lng"));

  if (
    latitude === null ||
    longitude === null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("zoom", "18");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "fa");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "Dashboard-info/1.0 (billboard location type)",
      },
      next: { revalidate: 86_400 },
    });

    if (!response.ok) {
      return NextResponse.json({ locationType: null }, { status: 200 });
    }

    const payload = (await response.json()) as NominatimReverse;
    const inferred = inferBillboardLocationType({
      osmClass: payload.category,
      osmType: payload.type,
      addresstype: payload.addresstype,
      name: payload.name,
      road: payload.address?.road,
      amenity: payload.address?.amenity,
      displayName: payload.display_name,
    });

    const locationType: BillboardLocationTypeKey | null =
      inferred && isBillboardLocationTypeKey(inferred) ? inferred : null;

    return NextResponse.json({
      locationType,
      label: payload.name ?? payload.address?.road ?? null,
    });
  } catch {
    return NextResponse.json({ locationType: null }, { status: 200 });
  } finally {
    clearTimeout(timeout);
  }
}
