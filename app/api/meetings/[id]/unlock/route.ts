import { NextResponse } from "next/server";
import { pgUnlockMeetingDetail } from "@/lib/db/repository-extended";
import { consumeRateLimit, getRequestClientIp } from "@/lib/security/rate-limit";
import { withFileAccessTokensDeep } from "@/lib/uploads";
import { isPostgresConfigured } from "@/lib/utils";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  if (!isPostgresConfigured()) {
    return NextResponse.json({ error: "Database required" }, { status: 503 });
  }

  const { id } = await params;
  const rate = consumeRateLimit(`unlock:meeting:${getRequestClientIp(request)}:${id}`, {
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

  const result = await pgUnlockMeetingDetail(id, password);

  if (result.status === "not_found") {
    return NextResponse.json({ error: "جلسه یافت نشد" }, { status: 404 });
  }

  if (result.status === "wrong_password") {
    return NextResponse.json({ error: "رمز اشتباه است" }, { status: 401 });
  }

  return NextResponse.json({ meeting: withFileAccessTokensDeep(result.meeting) });
}
