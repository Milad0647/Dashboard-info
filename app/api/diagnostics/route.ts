import { access, readdir } from "fs/promises";
import { checkDatabaseConnection, getSql } from "@/lib/db/client";
import { getUploadsDir, resolveUploadFilePath } from "@/lib/uploads";
import { getDatabaseMode } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function fileExists(filename: string): Promise<boolean> {
  try {
    await access(resolveUploadFilePath(filename));
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  const mode = getDatabaseMode();
  const uploadsDir = getUploadsDir();

  let uploadFileCount = 0;
  try {
    const files = await readdir(uploadsDir);
    uploadFileCount = files.filter((name) => !name.startsWith(".")).length;
  } catch {
    uploadFileCount = -1;
  }

  if (mode !== "postgres") {
    return Response.json({
      mode,
      uploadFileCount,
      uploadsDir,
      warning: "App is not using PostgreSQL — admin edits may not persist to public data.",
    });
  }

  const dbOk = await checkDatabaseConnection();
  if (!dbOk) {
    return Response.json(
      { mode, database: "disconnected", uploadFileCount, uploadsDir },
      { status: 503 }
    );
  }

  try {
    const sql = getSql();
    const [campaignRows, sampleRows] = await Promise.all([
      sql<{ slug: string; published: boolean }[]>`
        SELECT slug, published FROM campaign_settings ORDER BY updated_at DESC
      `,
      sql<{ image_url: string; thumbnail_url: string }[]>`
        SELECT pv.image_url, pv.thumbnail_url
        FROM poster_versions pv
        LIMIT 5
      `,
    ]);

    const mediaSamples = await Promise.all(
      sampleRows.map(async (row) => {
        const url = row.image_url || row.thumbnail_url || "";
        const filename = url.startsWith("/api/files/") ? url.replace("/api/files/", "") : null;
        return {
          url,
          fileExists: filename ? await fileExists(filename) : false,
        };
      })
    );

    return Response.json({
      mode,
      database: "connected",
      uploadFileCount,
      uploadsDir,
      campaigns: campaignRows,
      mediaSamples,
    });
  } catch (error) {
    return Response.json(
      {
        mode,
        database: "error",
        uploadFileCount,
        uploadsDir,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
