import { open, readFile, stat } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth/get-session";
import { verifyFileAccessToken } from "@/lib/auth/file-access-token";
import {
  ensureLocalImageThumbnail,
  isThumbnailableImageFilename,
} from "@/lib/server/image-thumbnail";
import { resolveUploadFilePath } from "@/lib/uploads";

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".txt": "text/plain",
};

function getContentType(filename: string): string {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  return MIME_TYPES[ext] ?? "application/octet-stream";
}

function sanitizeFilename(raw: string): string | null {
  const safeName = path.basename(raw.split("?")[0].split("#")[0]);
  if (!safeName || safeName === "." || safeName === "..") return null;
  return safeName;
}

async function canAccessFile(request: Request, filename: string): Promise<boolean> {
  const session = await getAuthSession();
  if (session) return true;

  const { searchParams } = new URL(request.url);
  return verifyFileAccessToken(filename, searchParams.get("exp"), searchParams.get("sig"));
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename: rawFilename } = await params;
  const filename = sanitizeFilename(decodeURIComponent(rawFilename));
  if (!filename) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!(await canAccessFile(request, filename))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const wantCardThumb =
    searchParams.get("thumb") === "1" && isThumbnailableImageFilename(filename);

  try {
    if (wantCardThumb) {
      const thumbName = await ensureLocalImageThumbnail(filename);
      if (thumbName) {
        const thumbPath = resolveUploadFilePath(thumbName);
        const thumbBuffer = await readFile(thumbPath);
        return new NextResponse(thumbBuffer, {
          headers: {
            "Content-Type": "image/webp",
            "Content-Length": String(thumbBuffer.byteLength),
            "Cache-Control": "private, max-age=86400",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
    }

    const filePath = resolveUploadFilePath(filename);
    const fileStat = await stat(filePath);

    if (!fileStat.isFile()) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const contentType = getContentType(filename);
    const fileSize = fileStat.size;
    const range = request.headers.get("range");

    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/i.exec(range);
      if (match) {
        const start = Number.parseInt(match[1], 10);
        const end = match[2] ? Number.parseInt(match[2], 10) : fileSize - 1;

        if (start >= fileSize || end >= fileSize || start > end) {
          return new NextResponse(null, {
            status: 416,
            headers: {
              "Content-Range": `bytes */${fileSize}`,
            },
          });
        }

        const chunkSize = end - start + 1;
        const fileHandle = await open(filePath, "r");
        const buffer = Buffer.alloc(chunkSize);

        try {
          await fileHandle.read(buffer, 0, chunkSize, start);
        } finally {
          await fileHandle.close();
        }

        return new NextResponse(buffer, {
          status: 206,
          headers: {
            "Content-Type": contentType,
            "Content-Length": String(chunkSize),
            "Content-Range": `bytes ${start}-${end}/${fileSize}`,
            "Accept-Ranges": "bytes",
            "Cache-Control": "private, max-age=3600",
          },
        });
      }
    }

    const fileHandle = await open(filePath, "r");
    const buffer = Buffer.alloc(fileSize);

    try {
      await fileHandle.read(buffer, 0, fileSize, 0);
    } finally {
      await fileHandle.close();
    }

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(fileSize),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
