import { createWriteStream } from "fs";
import { readFile, stat } from "fs/promises";
import { basename } from "path";
import { pipeline } from "stream/promises";
import JSZip from "jszip";
import { pgGetCampaignBackupData } from "@/lib/db/repository-extended";
import { getSql } from "@/lib/db/client";
import { getUploadsDir, getUploadPublicUrl } from "@/lib/uploads";
import { generateId } from "@/lib/utils";

/** Keep embedded media bounded so backup creation cannot OOM the Node process. */
const DEFAULT_MAX_UPLOAD_BYTES = 400 * 1024 * 1024;
const DEFAULT_MAX_SINGLE_FILE_BYTES = 80 * 1024 * 1024;

export interface CreateCampaignBackupOptions {
  includeUploads?: boolean;
  maxUploadBytes?: number;
  maxSingleFileBytes?: number;
}

export interface CampaignBackupWriteResult {
  includedFiles: number;
  skippedFiles: string[];
  sizeBytes: number;
}

function extractFilenameFromUrl(url: string): string | null {
  const match = url.match(/\/api\/files\/([^/?#]+)/);
  return match?.[1] ?? null;
}

function collectUploadFilenames(backup: NonNullable<
  Awaited<ReturnType<typeof pgGetCampaignBackupData>>
>): Set<string> {
  const fileUrls = new Set<string>();
  const collectUrl = (url?: string | null) => {
    if (!url) return;
    const filename = extractFilenameFromUrl(url);
    if (filename) fileUrls.add(filename);
  };

  for (const row of backup.billboards) {
    collectUrl(row.thumbnail_url);
    collectUrl(row.image_url);
  }
  for (const row of backup.posterVersions) {
    collectUrl(row.image_url);
    collectUrl(row.thumbnail_url);
  }
  for (const row of backup.videoVersions) {
    collectUrl(row.video_url);
    collectUrl(row.thumbnail_url);
  }
  for (const row of backup.files) {
    collectUrl(row.file_url);
  }
  for (const row of backup.socialPosts) {
    collectUrl(row.cover_image_url);
    collectUrl(row.media_url);
  }
  for (const row of backup.broadcastReports) {
    collectUrl(row.pdf_url);
  }

  return fileUrls;
}

async function buildCampaignBackupZip(
  campaignId: string,
  options: CreateCampaignBackupOptions = {}
): Promise<{ zip: JSZip; includedFiles: number; skippedFiles: string[] }> {
  const includeUploads = options.includeUploads !== false;
  const maxUploadBytes = options.maxUploadBytes ?? DEFAULT_MAX_UPLOAD_BYTES;
  const maxSingleFileBytes =
    options.maxSingleFileBytes ?? DEFAULT_MAX_SINGLE_FILE_BYTES;

  const backup = await pgGetCampaignBackupData(campaignId);
  if (!backup) {
    throw new Error("Campaign not found");
  }

  const skippedFiles: string[] = [];
  let includedFiles = 0;
  let usedUploadBytes = 0;

  const zip = new JSZip();
  zip.file(
    "manifest.json",
    JSON.stringify(
      {
        ...backup,
        backupMeta: {
          includeUploads,
          maxUploadBytes,
          maxSingleFileBytes,
        },
      },
      null,
      2
    )
  );

  if (!includeUploads) {
    zip.file(
      "uploads-skipped.json",
      JSON.stringify(
        {
          reason: "Uploads omitted; media remains on the server uploads volume.",
          filenames: [...collectUploadFilenames(backup)],
        },
        null,
        2
      )
    );
    return { zip, includedFiles, skippedFiles };
  }

  const uploadsDir = getUploadsDir();
  const fileUrls = collectUploadFilenames(backup);
  const filesFolder = zip.folder("uploads");

  for (const filename of fileUrls) {
    const filePath = `${uploadsDir}/${filename}`;
    try {
      const info = await stat(filePath);
      if (!info.isFile()) {
        skippedFiles.push(filename);
        continue;
      }
      if (info.size > maxSingleFileBytes) {
        skippedFiles.push(filename);
        continue;
      }
      if (usedUploadBytes + info.size > maxUploadBytes) {
        skippedFiles.push(filename);
        continue;
      }

      const content = await readFile(filePath);
      filesFolder?.file(filename, content);
      usedUploadBytes += content.byteLength;
      includedFiles += 1;
    } catch {
      skippedFiles.push(filename);
    }
  }

  if (skippedFiles.length > 0) {
    zip.file(
      "uploads-skipped.json",
      JSON.stringify(
        {
          reason:
            "Some media files were skipped to keep backup memory/size within safe limits.",
          maxUploadBytes,
          maxSingleFileBytes,
          filenames: skippedFiles,
        },
        null,
        2
      )
    );
  }

  return { zip, includedFiles, skippedFiles };
}

/** Build a campaign backup ZIP in memory (for immediate download). */
export async function createCampaignBackupZip(
  campaignId: string,
  options?: CreateCampaignBackupOptions
): Promise<Buffer> {
  const { zip } = await buildCampaignBackupZip(campaignId, options);
  return Buffer.from(
    await zip.generateAsync({ type: "nodebuffer", streamFiles: true })
  );
}

/** Build a campaign backup ZIP and stream it directly to disk (for stored backups). */
export async function writeCampaignBackupZipToFile(
  campaignId: string,
  outputPath: string,
  options?: CreateCampaignBackupOptions
): Promise<CampaignBackupWriteResult> {
  const { zip, includedFiles, skippedFiles } = await buildCampaignBackupZip(
    campaignId,
    options
  );

  const nodeStream = zip.generateNodeStream({
    type: "nodebuffer",
    streamFiles: true,
    compression: "DEFLATE",
  });

  await pipeline(nodeStream, createWriteStream(outputPath));

  const info = await stat(outputPath);
  return {
    includedFiles,
    skippedFiles,
    sizeBytes: info.size,
  };
}

export async function importCampaignBackupZip(buffer: Buffer, targetCampaignId?: string) {
  const zip = await JSZip.loadAsync(buffer);
  const manifestFile = zip.file("manifest.json");
  if (!manifestFile) {
    throw new Error("manifest.json not found in backup");
  }

  const manifest = JSON.parse(await manifestFile.async("string"));
  const sql = getSql();
  const uploadsDir = getUploadsDir();
  const urlMap = new Map<string, string>();

  const uploadEntries = Object.keys(zip.files).filter((name) => name.startsWith("uploads/"));
  for (const entryName of uploadEntries) {
    const entry = zip.files[entryName];
    if (!entry.dir) {
      const originalName = basename(entryName);
      const newName = `${generateId()}${originalName.includes(".") ? originalName.slice(originalName.lastIndexOf(".")) : ""}`;
      const content = await entry.async("nodebuffer");
      const { writeFile, mkdir } = await import("fs/promises");
      await mkdir(uploadsDir, { recursive: true });
      await writeFile(`${uploadsDir}/${newName}`, content);
      urlMap.set(originalName, getUploadPublicUrl(newName));
    }
  }

  const remapUrl = (url?: string | null): string => {
    if (!url) return "";
    const filename = extractFilenameFromUrl(url);
    if (!filename) return url;
    return urlMap.get(filename) ?? url;
  };

  const campaignRow = manifest.campaign;
  const campaignId = targetCampaignId ?? generateId();

  await sql`
    INSERT INTO campaign_settings (
      id, slug, title, description, status, start_date, end_date,
      cover_image_url, published, features, analytics_config, billboard_config, updated_at
    ) VALUES (
      ${campaignId},
      ${targetCampaignId ? campaignRow.slug + "-imported" : campaignRow.slug},
      ${campaignRow.title},
      ${campaignRow.description ?? ""},
      ${campaignRow.status ?? "draft"},
      ${campaignRow.start_date},
      ${campaignRow.end_date},
      ${remapUrl(campaignRow.cover_image_url) || null},
      ${campaignRow.published ?? false},
      ${sql.json(campaignRow.features ?? {})},
      ${sql.json(campaignRow.analytics_config ?? {})},
      ${sql.json(campaignRow.billboard_config ?? {})},
      ${new Date().toISOString()}
    )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      updated_at = EXCLUDED.updated_at
  `;

  const idMap = new Map<string, string>();
  const remapId = (oldId: string) => {
    if (!idMap.has(oldId)) idMap.set(oldId, generateId());
    return idMap.get(oldId)!;
  };

  for (const row of manifest.posterCategories ?? []) {
    const newId = remapId(row.id);
    await sql`
      INSERT INTO media_categories (id, campaign_id, type, title, description, sort_order, published, created_at)
      VALUES (${newId}, ${campaignId}, 'poster', ${row.title}, ${row.description}, ${row.sort_order ?? 0}, ${row.published ?? false}, ${row.created_at ?? new Date().toISOString()})
      ON CONFLICT (id) DO NOTHING
    `;
  }

  for (const row of manifest.videoCategories ?? []) {
    const newId = remapId(row.id);
    await sql`
      INSERT INTO media_categories (id, campaign_id, type, title, description, sort_order, published, created_at)
      VALUES (${newId}, ${campaignId}, 'video', ${row.title}, ${row.description}, ${row.sort_order ?? 0}, ${row.published ?? false}, ${row.created_at ?? new Date().toISOString()})
      ON CONFLICT (id) DO NOTHING
    `;
  }

  for (const row of manifest.billboards ?? []) {
    await sql`
      INSERT INTO billboards (
        id, campaign_id, title, description, city, location, date,
        thumbnail_url, image_url, external_url, published, sort_order, created_at, updated_at
      ) VALUES (
        ${generateId()}, ${campaignId}, ${row.title}, ${row.description}, ${row.city}, ${row.location}, ${row.date},
        ${remapUrl(row.thumbnail_url)}, ${remapUrl(row.image_url)}, ${row.external_url ?? ""},
        ${row.published ?? false}, ${row.sort_order ?? 0}, ${row.created_at ?? new Date().toISOString()}, ${new Date().toISOString()}
      )
    `;
  }

  for (const row of manifest.socialPosts ?? []) {
    await sql`
      INSERT INTO social_media_posts (
        id, campaign_id, platform, title, cover_image_url, views, likes, comments, shares,
        link, content_type, media_url, description, published_date, published, sort_order, created_at, updated_at
      ) VALUES (
        ${generateId()}, ${campaignId}, ${row.platform}, ${row.title}, ${remapUrl(row.cover_image_url)},
        ${row.views ?? 0}, ${row.likes ?? 0}, ${row.comments ?? 0}, ${row.shares ?? 0},
        ${row.link ?? ""}, ${row.content_type ?? "image"}, ${remapUrl(row.media_url)}, ${row.description},
        ${row.published_date ?? new Date().toISOString().split("T")[0]}, ${row.published ?? false},
        ${row.sort_order ?? 0}, ${new Date().toISOString()}, ${new Date().toISOString()}
      )
    `;
  }

  for (const row of manifest.broadcastReports ?? []) {
    await sql`
      INSERT INTO broadcast_reports (
        id, campaign_id, title, report_date, pdf_url, file_name, summary_data, published, sort_order, created_at, updated_at
      ) VALUES (
        ${generateId()}, ${campaignId}, ${row.title}, ${row.report_date},
        ${remapUrl(row.pdf_url)}, ${row.file_name}, ${sql.json(row.summary_data ?? {})},
        ${row.published ?? false}, ${row.sort_order ?? 0}, ${new Date().toISOString()}, ${new Date().toISOString()}
      )
    `;
  }

  return { success: true, campaignId };
}
