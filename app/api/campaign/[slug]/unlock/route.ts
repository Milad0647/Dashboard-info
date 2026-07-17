import { NextResponse } from "next/server";
import {
  createCampaignPageUnlockToken,
  getCampaignPageUnlockCookieName,
  getCampaignPageUnlockCookieOptions,
} from "@/lib/campaign-page-unlock";
import { pgVerifyCampaignPagePassword } from "@/lib/db/repository-extended";
import { consumeRateLimit, getRequestClientIp } from "@/lib/security/rate-limit";
import { isPostgresConfigured } from "@/lib/utils";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  if (!isPostgresConfigured()) {
    return NextResponse.json({ error: "Database required" }, { status: 503 });
  }

  const { slug } = await params;
  const rate = consumeRateLimit(`unlock:page:${getRequestClientIp(request)}:${slug}`, {
    limit: 10,
    windowMs: 15 * 60 * 1000,
    lockMs: 15 * 60 * 1000,
  });
  if (!rate.ok) {
    return NextResponse.json(
      { error: `تلاش بیش از حد. ${rate.retryAfterSec} ثانیه صبر کنید` },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } }
    );
  }

  const body = (await request.json().catch(() => null)) as { password?: string } | null;
  const password = body?.password ?? "";

  const result = await pgVerifyCampaignPagePassword(slug, password);

  if (result.status === "not_found") {
    return NextResponse.json({ error: "کمپین یافت نشد" }, { status: 404 });
  }

  if (result.status === "wrong_password") {
    return NextResponse.json({ error: "رمز اشتباه است" }, { status: 401 });
  }

  if (result.passwordHash) {
    const token = await createCampaignPageUnlockToken(slug, result.passwordHash);
    const cookieStore = await cookies();
    cookieStore.set(
      getCampaignPageUnlockCookieName(slug),
      token,
      getCampaignPageUnlockCookieOptions()
    );
  }

  return NextResponse.json({ success: true });
}
