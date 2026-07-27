import { NextResponse } from "next/server";
import { getAuthSession, isFullAdmin } from "@/lib/auth/get-session";
import {
  deleteStoredBackups,
  deleteStoredBackupsOlderThan,
  pruneStoredBackups,
} from "@/lib/services/stored-backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireFullAdmin() {
  const session = await getAuthSession();
  if (!session || !isFullAdmin(session)) return null;
  return session;
}

/**
 * Bulk cleanup of stored backups.
 * Body:
 * - { filenames: string[] } — delete exact files
 * - { olderThanDays: number } — delete files older than N days
 * - { keepCampaignPerSlug?: number, keepDbDumps?: number } — keep newest N
 */
export async function POST(request: Request) {
  if (!(await requireFullAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    filenames?: string[];
    olderThanDays?: number;
    keepCampaignPerSlug?: number;
    keepDbDumps?: number;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    if (Array.isArray(body.filenames) && body.filenames.length > 0) {
      const result = await deleteStoredBackups(body.filenames);
      return NextResponse.json({ success: true, ...result });
    }

    if (typeof body.olderThanDays === "number") {
      const result = await deleteStoredBackupsOlderThan(body.olderThanDays);
      return NextResponse.json({ success: true, ...result });
    }

    if (
      typeof body.keepCampaignPerSlug === "number" ||
      typeof body.keepDbDumps === "number"
    ) {
      const result = await pruneStoredBackups({
        keepCampaignPerSlug: body.keepCampaignPerSlug,
        keepDbDumps: body.keepDbDumps,
      });
      return NextResponse.json({ success: true, ...result });
    }

    return NextResponse.json(
      {
        error:
          "Provide filenames, olderThanDays, or keepCampaignPerSlug/keepDbDumps",
      },
      { status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Cleanup failed";
    console.error("[backups/cleanup] failed", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
