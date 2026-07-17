/**
 * Client-side helpers to capture a low-size WebP cover from a video.
 * Used on upload and when backfilling existing videos without a cover.
 */

import {
  isAparatVideoInput,
  isDirectVideoUrl,
  isLocalUploadedFileUrl,
  resolveAbsoluteMediaUrl,
  resolveVideoThumbnail,
} from "@/lib/media-utils";

const COVER_SEEK_SECONDS = 3;
const COVER_MAX_WIDTH = 720;
const COVER_WEBP_QUALITY = 0.72;

type RevokableVideo = HTMLVideoElement & { __revoke?: () => void };

function loadVideoElement(src: string, revokeObjectUrl?: string): Promise<RevokableVideo> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video") as RevokableVideo;
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.crossOrigin = "anonymous";
    video.src = src;

    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
      if (revokeObjectUrl) URL.revokeObjectURL(revokeObjectUrl);
    };
    video.__revoke = cleanup;

    video.onloadedmetadata = () => resolve(video);
    video.onerror = () => {
      cleanup();
      reject(new Error("بارگذاری ویدیو برای ساخت کاور ناموفق بود"));
    };
  });
}

function loadVideoFromFile(file: File): Promise<RevokableVideo> {
  const objectUrl = URL.createObjectURL(file);
  return loadVideoElement(objectUrl, objectUrl);
}

function loadVideoFromUrl(videoUrl: string): Promise<RevokableVideo> {
  return loadVideoElement(resolveAbsoluteMediaUrl(videoUrl));
}

function seekVideo(video: HTMLVideoElement, timeSec: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    const target =
      duration > 0 ? Math.min(Math.max(timeSec, 0), Math.max(duration - 0.05, 0)) : timeSec;

    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      resolve();
    };
    const onError = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      reject(new Error("جابه‌جایی به ثانیه کاور ناموفق بود"));
    };

    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);

    try {
      video.currentTime = target;
    } catch {
      onError();
    }
  });
}

function canvasToWebpBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("ساخت تصویر WebP ناموفق بود"));
      },
      "image/webp",
      quality
    );
  });
}

async function captureFrameFromVideo(
  video: RevokableVideo,
  seekSeconds = COVER_SEEK_SECONDS
): Promise<Blob> {
  try {
    await seekVideo(video, seekSeconds);

    const sourceWidth = video.videoWidth || 1280;
    const sourceHeight = video.videoHeight || 720;
    const scale = Math.min(1, COVER_MAX_WIDTH / sourceWidth);
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas در دسترس نیست");
    }

    context.drawImage(video, 0, 0, width, height);
    return await canvasToWebpBlob(canvas, COVER_WEBP_QUALITY);
  } finally {
    video.__revoke?.();
  }
}

/** True when this video can and should get an auto-generated cover. */
export function videoNeedsAutoCover(videoUrl: string, thumbnailUrl?: string | null): boolean {
  const trimmed = videoUrl.trim();
  if (!trimmed) return false;
  if (isAparatVideoInput(trimmed)) return false;
  if (!isDirectVideoUrl(trimmed) && !isLocalUploadedFileUrl(trimmed)) return false;
  return !resolveVideoThumbnail(trimmed, thumbnailUrl);
}

/** Capture a frame near second 3 from a File and encode as compact WebP. */
export async function captureVideoCoverWebp(
  file: File,
  seekSeconds = COVER_SEEK_SECONDS
): Promise<Blob> {
  const video = await loadVideoFromFile(file);
  return captureFrameFromVideo(video, seekSeconds);
}

/** Capture a frame near second 3 from an already-uploaded video URL. */
export async function captureVideoCoverWebpFromUrl(
  videoUrl: string,
  seekSeconds = COVER_SEEK_SECONDS
): Promise<Blob> {
  const video = await loadVideoFromUrl(videoUrl);
  return captureFrameFromVideo(video, seekSeconds);
}

async function uploadImageBlob(blob: Blob, fileName: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", blob, fileName);
  formData.append("kind", "image");

  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? "آپلود کاور ویدیو ناموفق بود");
  }

  const data = (await response.json()) as { url: string };
  return data.url;
}

/**
 * Capture a WebP cover from the video file and upload it.
 * Returns the public cover URL.
 */
export async function captureAndUploadVideoCover(
  file: File,
  seekSeconds = COVER_SEEK_SECONDS
): Promise<string> {
  const blob = await captureVideoCoverWebp(file, seekSeconds);
  const baseName = file.name.replace(/\.[^.]+$/, "") || "video";
  return uploadImageBlob(blob, `${baseName}-cover.webp`);
}

/**
 * Capture a WebP cover from an existing video URL and upload it.
 * Returns the public cover URL.
 */
export async function captureAndUploadVideoCoverFromUrl(
  videoUrl: string,
  seekSeconds = COVER_SEEK_SECONDS
): Promise<string> {
  const blob = await captureVideoCoverWebpFromUrl(videoUrl, seekSeconds);
  const safeName =
    videoUrl
      .split("/")
      .pop()
      ?.replace(/\.[^.]+$/, "")
      ?.replace(/[^a-zA-Z0-9_-]/g, "") || "video";
  return uploadImageBlob(blob, `${safeName}-cover.webp`);
}
