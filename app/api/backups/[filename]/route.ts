import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminSessionCookieName } from "@/lib/auth/admin-session";
import { isFullAdmin } from "@/lib/auth/get-session";
import { parseSessionTokenSync } from "@/lib/auth/session-node";
import { isSafeBackupFilename } from "@/lib/backups";
import {
  deleteStoredBackup,
  openStoredBackupStream,
} from "@/lib/services/stored-backup";

export const dynamic = "force-dynamic";

async function requireFullAdmin() {
  const cookieStore = await cookies();
  const session = parseSessionTokenSync(
    cookieStore.get(getAdminSessionCookieName())?.value
  );
  if (!session || !isFullAdmin(session)) return null;
  return session;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  if (!(await requireFullAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { filename: raw } = await params;
  const filename = decodeURIComponent(raw);
  if (!isSafeBackupFilename(filename)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const opened = openStoredBackupStream(filename);
  if (!opened) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(opened.stream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  if (!(await requireFullAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { filename: raw } = await params;
  const filename = decodeURIComponent(raw);
  if (!isSafeBackupFilename(filename)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const deleted = await deleteStoredBackup(filename);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
