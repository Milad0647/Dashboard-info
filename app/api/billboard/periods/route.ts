import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/get-session";
import { pgGetBillboardPeriods } from "@/lib/db/repository";

import { withFileAccessTokensDeep } from "@/lib/uploads";

export async function GET(request: Request) {
  const session = await getAuthSession();
  if (!session?.userId && session?.type !== "env_admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const billboardId = searchParams.get("billboardId")?.trim();
  if (!billboardId) {
    return NextResponse.json({ error: "شناسه الزامی است" }, { status: 400 });
  }

  const periods = await pgGetBillboardPeriods(billboardId);
  return NextResponse.json({ periods: withFileAccessTokensDeep(periods) });
}
