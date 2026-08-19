import { readdir, stat } from "fs/promises";
import { NextResponse } from "next/server";
import { getAuthSession, isFullAdmin } from "@/lib/auth/get-session";
import { isPostgresConfigured } from "@/lib/utils";
import { pgGetAdminData } from "@/lib/db/repository";
import { getUploadsDir, stripFileAccessToken } from "@/lib/uploads";

function extractLocalFilename(url: string): string | null {
  const match = url.match(/\/api\/files\/([^/?#]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export async function POST(request: Request) {
  const session = await getAuthSession();
  if (!session || !isFullAdmin(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isPostgresConfigured()) {
    return NextResponse.json({ error: "Database required" }, { status: 503 });
  }

  let body: { campaignId?: string };
  try {
    body = (await request.json()) as { campaignId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.campaignId) {
    return NextResponse.json({ error: "campaignId is required" }, { status: 400 });
  }

  // 1. Check uploads directory
  const uploadsDir = getUploadsDir();
  let diskFiles: string[] = [];
  let diskFileCount = 0;
  let diskTotalBytes = 0;
  try {
    diskFiles = await readdir(uploadsDir);
    diskFileCount = diskFiles.filter((f) => f !== ".gitkeep").length;
    for (const f of diskFiles) {
      if (f === ".gitkeep") continue;
      try {
        const s = await stat(`${uploadsDir}/${f}`);
        diskTotalBytes += s.size;
      } catch { /* skip */ }
    }
  } catch (err) {
    return NextResponse.json({
      error: `Cannot read uploads dir: ${uploadsDir}`,
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  // 2. Check billboard image URLs in DB
  const data = await pgGetAdminData(body.campaignId, undefined, ["billboards"]);
  const billboards = data.billboards ?? [];

  let localUrlCount = 0;
  let remoteUrlCount = 0;
  let emptyUrlCount = 0;
  let localFileExists = 0;
  let localFileMissing = 0;
  const missingFiles: string[] = [];
  const sampleRemoteUrls: string[] = [];

  for (const b of billboards) {
    const url = stripFileAccessToken(b.imageUrl || b.thumbnailUrl || "");
    if (!url) {
      emptyUrlCount++;
      continue;
    }

    const filename = extractLocalFilename(url);
    if (filename) {
      localUrlCount++;
      if (diskFiles.includes(filename)) {
        localFileExists++;
      } else {
        localFileMissing++;
        if (missingFiles.length < 20) missingFiles.push(filename);
      }
    } else if (url.startsWith("http://") || url.startsWith("https://")) {
      remoteUrlCount++;
      if (sampleRemoteUrls.length < 10) sampleRemoteUrls.push(url);
    } else {
      emptyUrlCount++;
    }
  }

  return NextResponse.json({
    uploadsDir,
    disk: {
      fileCount: diskFileCount,
      totalSizeMB: Math.round(diskTotalBytes / 1024 / 1024 * 10) / 10,
    },
    billboards: {
      total: billboards.length,
      localUrl: localUrlCount,
      remoteUrl: remoteUrlCount,
      emptyUrl: emptyUrlCount,
      localFileExists,
      localFileMissing,
    },
    missingFiles,
    sampleRemoteUrls,
  });
}
