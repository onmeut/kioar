import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";

import { safeFetch } from "@/lib/ssrf";

export type UploadFolder = "avatars" | "events" | "link-covers" | "link-icons";

export type UploadResult = {
  url: string;
  pathname: string;
};

// Max bytes accepted from the client. We reduce from 5MB because we always
// re-encode through sharp and write a much smaller output anyway.
const MAX_INPUT_BYTES = 4_000_000;
// Max pixel dimensions we'll render out. Limits DoS via huge decode buffers.
const MAX_IMAGE_DIMENSION = 2400;

type S3Config = {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  region: string;
  publicBase: string;
  forcePathStyle: boolean;
};

let cachedConfig: S3Config | null | undefined;
let cachedClient: S3Client | null = null;

function getS3Config(): S3Config | null {
  if (cachedConfig !== undefined) return cachedConfig;

  const endpoint = process.env.S3_ENDPOINT?.trim();
  const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.S3_BUCKET?.trim();

  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    cachedConfig = null;
    return null;
  }

  const region = process.env.S3_REGION?.trim() || "us-east-1";
  const forcePathStyle = process.env.S3_FORCE_PATH_STYLE !== "false";
  const publicBase = (
    process.env.S3_PUBLIC_URL_BASE?.trim() ||
    (forcePathStyle
      ? `${endpoint.replace(/\/$/, "")}/${bucket}`
      : endpoint.replace(/^(https?:\/\/)/, `$1${bucket}.`))
  ).replace(/\/$/, "");

  cachedConfig = {
    endpoint,
    accessKeyId,
    secretAccessKey,
    bucket,
    region,
    publicBase,
    forcePathStyle,
  };
  return cachedConfig;
}

function getS3Client(cfg: S3Config): S3Client {
  if (!cachedClient) {
    cachedClient = new S3Client({
      region: cfg.region,
      endpoint: cfg.endpoint,
      forcePathStyle: cfg.forcePathStyle,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
    });
  }
  return cachedClient;
}

function sanitizeFolder(folder: UploadFolder): string {
  return folder.replace(/[^a-z0-9-]/gi, "");
}

type NormalizedImage = {
  buffer: Buffer;
  contentType: "image/webp" | "image/png";
  extension: "webp" | "png";
};

/**
 * Normalize arbitrary user-supplied image bytes into a safe, re-encoded image.
 *
 * WHY: trusting the uploaded MIME/extension is unsafe.
 *   - SVG is XML and can contain <script> / external resources -> stored XSS
 *     when served inline. We refuse SVG entirely.
 *   - EXIF metadata on avatars often contains GPS coordinates (PII leak); sharp
 *     strips it by default on re-encode.
 *   - Re-encoding through a decoder also detects polyglot files (e.g. a PHP
 *     file renamed .jpg) which would otherwise sit in our bucket.
 *   - Pixel-dimension cap mitigates decode-bomb DoS.
 */
async function normalizeImage(input: Buffer): Promise<NormalizedImage> {
  if (input.byteLength === 0) {
    throw new Error("تصویر خالی است.");
  }
  if (input.byteLength > MAX_INPUT_BYTES) {
    throw new Error("حجم تصویر باید کمتر از ۴ مگابایت باشد.");
  }

  let pipeline: sharp.Sharp;
  let metadata: sharp.Metadata;
  try {
    pipeline = sharp(input, { failOn: "error" }).rotate(); // apply EXIF orientation then strip metadata on re-encode
    metadata = await pipeline.metadata();
  } catch {
    throw new Error("فقط فایل تصویری قابل آپلود است.");
  }

  const format = metadata.format;
  if (!format || format === "svg" || format === "magick") {
    // SVG is unsafe to serve inline; other vector formats are refused.
    throw new Error("فرمت تصویر پشتیبانی نمی‌شود.");
  }

  if (
    (metadata.width ?? 0) > MAX_IMAGE_DIMENSION * 4 ||
    (metadata.height ?? 0) > MAX_IMAGE_DIMENSION * 4
  ) {
    throw new Error("ابعاد تصویر بیش از حد مجاز است.");
  }

  pipeline = pipeline.resize({
    width: MAX_IMAGE_DIMENSION,
    height: MAX_IMAGE_DIMENSION,
    fit: "inside",
    withoutEnlargement: true,
  });

  // Keep PNG when the source has an alpha channel; WebP otherwise (smaller).
  const hasAlpha = metadata.hasAlpha === true;
  if (hasAlpha) {
    const buffer = await pipeline
      .png({ compressionLevel: 9, palette: true })
      .toBuffer();
    return { buffer, contentType: "image/png", extension: "png" };
  }

  const buffer = await pipeline.webp({ quality: 82, effort: 4 }).toBuffer();
  return { buffer, contentType: "image/webp", extension: "webp" };
}

async function putLocal(
  folder: UploadFolder,
  fileName: string,
  buffer: Buffer,
): Promise<UploadResult> {
  const relativeDir = path.posix.join("uploads", sanitizeFolder(folder));
  const absoluteDir = path.join(process.cwd(), "public", relativeDir);
  await mkdir(absoluteDir, { recursive: true });
  await writeFile(path.join(absoluteDir, fileName), buffer);
  const pathname = path.posix.join(relativeDir, fileName);
  return { url: `/${pathname}`, pathname };
}

async function putS3(
  folder: UploadFolder,
  fileName: string,
  buffer: Buffer,
  contentType: string,
): Promise<UploadResult> {
  const cfg = getS3Config();
  if (!cfg) throw new Error("S3 is not configured.");
  const key = `${sanitizeFolder(folder)}/${fileName}`;
  await getS3Client(cfg).send(
    new PutObjectCommand({
      Bucket: cfg.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ACL: "public-read",
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );
  return {
    url: `${cfg.publicBase}/${key}`,
    pathname: key,
  };
}

async function putBuffer(
  folder: UploadFolder,
  fileName: string,
  buffer: Buffer,
  contentType: string,
): Promise<UploadResult> {
  if (getS3Config()) {
    return putS3(folder, fileName, buffer, contentType);
  }
  return putLocal(folder, fileName, buffer);
}

export async function uploadPublicImage(
  file: File,
  folder: UploadFolder,
): Promise<UploadResult | null> {
  if (file.size === 0) return null;

  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("حجم تصویر باید کمتر از ۴ مگابایت باشد.");
  }

  const input = Buffer.from(await file.arrayBuffer());
  const normalized = await normalizeImage(input);

  const fileName = `${Date.now()}-${randomUUID()}.${normalized.extension}`;
  return putBuffer(folder, fileName, normalized.buffer, normalized.contentType);
}

/**
 * Download a remote image (OG image, favicon, etc.) via the SSRF-safe fetch
 * and re-host it in our bucket. Re-encodes through sharp so any XSS payload in
 * SVG/HTML-disguised-as-image is neutralized. Returns `null` on any failure.
 */
export async function uploadImageFromUrl(
  sourceUrl: string,
  folder: UploadFolder,
): Promise<UploadResult | null> {
  const fetched = await safeFetch(sourceUrl, {
    accept: "image/*",
    maxBytes: MAX_INPUT_BYTES,
    timeoutMs: 8000,
  });
  if (!fetched.ok) return null;
  if (!fetched.contentType.startsWith("image/")) return null;

  try {
    const normalized = await normalizeImage(fetched.body);
    const fileName = `${Date.now()}-${randomUUID()}.${normalized.extension}`;
    return await putBuffer(
      folder,
      fileName,
      normalized.buffer,
      normalized.contentType,
    );
  } catch {
    return null;
  }
}

export function storageDriverName(): "s3" | "local" {
  return getS3Config() ? "s3" : "local";
}
