import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/get-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lightweight auth probe for the admin panel session guard.
 * Returns 401 when the signed cookie is missing, expired, or revoked.
 */
export async function GET() {
  const session = await getAuthSession();
  if (!session) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    role: session.role,
    type: session.type,
  });
}
