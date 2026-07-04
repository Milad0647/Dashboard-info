import { billboardApiRoutes } from "@/lib/routes/billboard-api";

const TOKEN_CACHE_TTL_MS = 55 * 60 * 1000;

let cachedLoginToken: { value: string; fetchedAt: number } | null = null;

function getStaticBillboardApiToken(): string | null {
  const token = process.env.BILLBOARD_API_TOKEN?.trim();
  if (!token || token === "your-service-token") {
    return null;
  }
  return token;
}

function getBillboardApiCredentials(): { email: string; password: string } | null {
  const email = process.env.BILLBOARD_API_EMAIL?.trim();
  const password = process.env.BILLBOARD_API_PASSWORD?.trim();
  if (!email || !password) return null;
  return { email, password };
}

function extractLoginToken(body: unknown): string {
  if (!body || typeof body !== "object") {
    throw new Error("پاسخ ورود به Map-Bilboard نامعتبر است");
  }

  const record = body as Record<string, unknown>;
  const data = record.data;
  if (data && typeof data === "object") {
    const token = (data as Record<string, unknown>).token;
    if (typeof token === "string" && token.trim()) {
      return token.trim();
    }
  }

  throw new Error("توکن ورود از Map-Bilboard دریافت نشد");
}

async function loginForBillboardApiToken(email: string, password: string): Promise<string> {
  const response = await fetch(billboardApiRoutes.authLogin(), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  const raw = await response.text();
  let body: unknown = null;
  if (raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      body = null;
    }
  }

  if (!response.ok) {
    const message =
      body &&
      typeof body === "object" &&
      "message" in body &&
      typeof (body as { message?: unknown }).message === "string"
        ? (body as { message: string }).message
        : raw.trim() || `خطای ${response.status} هنگام ورود به Map-Bilboard`;

    if (response.status === 401 || response.status === 422) {
      throw new Error(
        "ورود به Map-Bilboard ناموفق بود. BILLBOARD_API_EMAIL و BILLBOARD_API_PASSWORD را در env سرور بررسی کنید."
      );
    }

    throw new Error(message);
  }

  return extractLoginToken(body);
}

export function clearBillboardApiTokenCache(): void {
  cachedLoginToken = null;
}

export async function resolveBillboardApiToken(options?: {
  forceRefresh?: boolean;
}): Promise<string> {
  const credentials = getBillboardApiCredentials();

  if (options?.forceRefresh && credentials) {
    clearBillboardApiTokenCache();
    const token = await loginForBillboardApiToken(credentials.email, credentials.password);
    cachedLoginToken = { value: token, fetchedAt: Date.now() };
    return token;
  }

  const staticToken = getStaticBillboardApiToken();
  if (staticToken) {
    return staticToken;
  }

  if (!credentials) {
    throw new Error(
      "اتصال Map-Bilboard تنظیم نشده: BILLBOARD_API_TOKEN یا BILLBOARD_API_EMAIL و BILLBOARD_API_PASSWORD را در env سرور قرار دهید."
    );
  }

  if (
    cachedLoginToken &&
    Date.now() - cachedLoginToken.fetchedAt < TOKEN_CACHE_TTL_MS
  ) {
    return cachedLoginToken.value;
  }

  const token = await loginForBillboardApiToken(credentials.email, credentials.password);
  cachedLoginToken = { value: token, fetchedAt: Date.now() };
  return token;
}

export async function formatBillboardApiError(response: Response, rawBody: string): Promise<string> {
  let body: unknown = null;
  if (rawBody) {
    try {
      body = JSON.parse(rawBody);
    } catch {
      body = null;
    }
  }

  if (response.status === 401) {
    const hasCredentials = Boolean(getBillboardApiCredentials());
    const hasStaticToken = Boolean(getStaticBillboardApiToken());

    if (hasStaticToken && !hasCredentials) {
      return "توکن Map-Bilboard نامعتبر است. BILLBOARD_API_TOKEN را در env سرور با یک Sanctum token معتبر از پنل billboard.pixlink.ir به‌روز کنید.";
    }

    return "احراز هویت Map-Bilboard ناموفق بود. BILLBOARD_API_TOKEN یا BILLBOARD_API_EMAIL/PASSWORD را در env سرور بررسی کنید.";
  }

  if (body && typeof body === "object") {
    const record = body as Record<string, unknown>;
    if (typeof record.message === "string" && record.message.trim()) {
      return record.message.trim();
    }

    const errors = record.errors;
    if (errors && typeof errors === "object") {
      const first = Object.values(errors as Record<string, unknown>)[0];
      if (Array.isArray(first) && typeof first[0] === "string") {
        return first[0];
      }
    }
  }

  return rawBody.trim() || `خطای ${response.status} از سرویس Map-Bilboard`;
}
