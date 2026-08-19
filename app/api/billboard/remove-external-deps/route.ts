import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAuthSession, isFullAdmin } from "@/lib/auth/get-session";
import { isPostgresConfigured } from "@/lib/utils";
import { getSql } from "@/lib/db/client";
import { stripFileAccessToken } from "@/lib/uploads";
import { downloadRemoteImageToLocal } from "@/lib/services/save-uploaded-file";

function isRemoteUrl(url?: string | null): boolean {
  if (!url?.trim()) return false;
  return url.startsWith("http://") || url.startsWith("https://");
}

function cleanTags(tags: string[]): string[] {
  return tags.filter(
    (tag) =>
      !tag.startsWith("map:") &&
      !tag.startsWith("assignment:") &&
      !tag.startsWith("provider:")
  );
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

  const sql = getSql();

  const rows = await sql`
    SELECT id, thumbnail_url, image_url, source, external_id, tags
    FROM billboards
    WHERE campaign_id = ${body.campaignId}
  `;

  let imagesLocalized = 0;
  let imagesFailed = 0;
  let tagsCleanedCount = 0;
  let sourceFixedCount = 0;
  let externalIdClearedCount = 0;
  let alreadyClean = 0;

  for (const row of rows) {
    const id = row.id as string;
    let thumbnailUrl = (row.thumbnail_url as string) || "";
    let imageUrl = (row.image_url as string) || "";
    const source = (row.source as string) || "manual";
    const externalId = row.external_id as string | null;
    const tags: string[] = Array.isArray(row.tags) ? row.tags : [];

    let changed = false;

    // 1. Localize remote image URLs
    if (isRemoteUrl(imageUrl)) {
      const local = await downloadRemoteImageToLocal(stripFileAccessToken(imageUrl));
      if (local) {
        imageUrl = local;
        changed = true;
        imagesLocalized++;
      } else {
        imagesFailed++;
      }
    }
    if (isRemoteUrl(thumbnailUrl)) {
      const local = await downloadRemoteImageToLocal(stripFileAccessToken(thumbnailUrl));
      if (local) {
        thumbnailUrl = local;
        changed = true;
        imagesLocalized++;
      } else {
        imagesFailed++;
      }
    }

    // 2. Clean external tags
    const cleanedTags = cleanTags(tags);
    const tagsChanged = cleanedTags.length !== tags.length;
    if (tagsChanged) {
      tagsCleanedCount++;
      changed = true;
    }

    // 3. Fix source
    const needsSourceFix = source === "api";
    if (needsSourceFix) {
      sourceFixedCount++;
      changed = true;
    }

    // 4. Clear external_id
    const needsExternalIdClear = Boolean(externalId);
    if (needsExternalIdClear) {
      externalIdClearedCount++;
      changed = true;
    }

    if (!changed) {
      alreadyClean++;
      continue;
    }

    await sql`
      UPDATE billboards SET
        thumbnail_url = ${thumbnailUrl},
        image_url = ${imageUrl},
        source = ${needsSourceFix ? "manual" : source},
        external_id = ${needsExternalIdClear ? null : externalId},
        tags = ${sql.array(tagsChanged ? cleanedTags : tags)},
        updated_at = NOW()
      WHERE id = ${id}
    `;
  }

  // Also clean display periods
  const periodRows = await sql`
    SELECT dp.id, dp.billboard_image_url, dp.confirmation_image_url
    FROM billboard_display_periods dp
    JOIN billboards b ON b.id = dp.billboard_id
    WHERE b.campaign_id = ${body.campaignId}
      AND (
        dp.billboard_image_url LIKE 'http://%'
        OR dp.billboard_image_url LIKE 'https://%'
        OR dp.confirmation_image_url LIKE 'http://%'
        OR dp.confirmation_image_url LIKE 'https://%'
      )
  `;

  let periodsFixed = 0;
  for (const pr of periodRows) {
    let billboardImageUrl = (pr.billboard_image_url as string) || "";
    let confirmationImageUrl = (pr.confirmation_image_url as string) || null;
    let pChanged = false;

    if (isRemoteUrl(billboardImageUrl)) {
      const local = await downloadRemoteImageToLocal(stripFileAccessToken(billboardImageUrl));
      if (local) { billboardImageUrl = local; pChanged = true; }
    }
    if (isRemoteUrl(confirmationImageUrl)) {
      const local = await downloadRemoteImageToLocal(stripFileAccessToken(confirmationImageUrl!));
      if (local) { confirmationImageUrl = local; pChanged = true; }
    }

    if (pChanged) {
      await sql`
        UPDATE billboard_display_periods SET
          billboard_image_url = ${billboardImageUrl},
          confirmation_image_url = ${confirmationImageUrl}
        WHERE id = ${pr.id}
      `;
      periodsFixed++;
    }
  }

  revalidatePath("/admin/billboards");
  revalidatePath("/admin");

  return NextResponse.json({
    success: true,
    total: rows.length,
    imagesLocalized,
    imagesFailed,
    tagsCleanedCount,
    sourceFixedCount,
    externalIdClearedCount,
    periodsFixed,
    alreadyClean,
  });
}
