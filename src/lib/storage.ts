import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { availableParallelism } from "node:os";
import path from "node:path";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import sharp from "sharp";

import { safeFetch } from "@/lib/ssrf";

export type UploadFolder =
  | "avatars"
  | "events"
  | "link-covers"
  | "link-icons"
  | "product-items"
  | "products"
  | "media";

export type UploadResult = {
  url: string;
  pathname: string;
};

// ---------- non-image media uploads (video / PDF) ----------------------------
//
// The image pipeline above re-encodes every byte through sharp, which is both
// our normalization step AND our security boundary (a polyglot/JS-in-SVG file
// can't survive a re-encode). Video and PDF can't be re-encoded without adding
// ffmpeg / a PDF rasterizer, so for those formats the ONLY boundary is an
// up-front magic-byte sniff + a hard extension whitelist. Keep this strict.

/** Allowed video kinds the media block accepts. */
export type MediaFileKind = "video" | "file";

/**
 * Hardcoded extension whitelist per kind (NOT in the admin panel — these are a
 * security boundary, per spec). Photos are handled by the image path; listed
 * here only for reference / shared validation.
 */
export const MEDIA_EXTENSION_WHITELIST = {
  image: ["jpg", "jpeg", "png", "webp", "gif"],
  video: ["mp4", "mov"],
  file: ["pdf"],
} as const;

const MEDIA_VIDEO_CONTENT_TYPE: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
};

// Generous ceiling for any single non-image upload accepted at the storage
// layer. Per-plan caps (media_max_video_mb / media_max_file_mb) are enforced
// earlier in the service against the registry; this is just a hard backstop so
// a single request can't stream an unbounded body into memory.
const MAX_MEDIA_FILE_BYTES = 200_000_000;

function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

/**
 * Sniff the leading bytes of an uploaded buffer to confirm it really is the
 * format its extension claims. The client-supplied MIME and extension cannot
 * be trusted (an executable renamed `.pdf` would otherwise land in the bucket).
 */
function detectMediaFormat(input: Buffer): "mp4" | "mov" | "pdf" | null {
  if (input.byteLength < 12) return null;
  // PDF: "%PDF-" at the very start.
  if (input.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
  // MP4 / MOV (QuickTime): ISO-BMFF box — bytes 4..8 are the "ftyp" atom tag.
  // We treat both as the same container family; the extension disambiguates
  // the stored content-type. Major brands differ (isom/mp42 vs qt) but for
  // our purpose "has an ftyp box" is the gate.
  if (input.subarray(4, 8).toString("latin1") === "ftyp") {
    const brand = input.subarray(8, 12).toString("latin1");
    return brand.startsWith("qt") ? "mov" : "mp4";
  }
  return null;
}

// Max bytes accepted from the client. iPhone HEIC photos client-converted to
// JPEG can grow to ~6-8MB at high quality, so we allow a little more headroom
// than the raw HEIC source. We always re-encode through sharp to a much
// smaller output anyway.
const MAX_INPUT_BYTES = 8_000_000;
// Max pixel dimensions we'll render out. Limits DoS via huge decode buffers.
const MAX_IMAGE_DIMENSION = 2400;

// ---------- image-processing concurrency gate --------------------------------
//
// `sharp` is CPU-bound. Without a cap, a burst of uploads can pin every core
// and stall unrelated requests served by the same Node process. We gate
// `normalizeImage` through a lightweight semaphore tuned to available CPUs.
// Configurable via `IMAGE_PROCESSING_CONCURRENCY` (default min(4, cpus)).

function parseImageConcurrency(): number {
  const raw = process.env.IMAGE_PROCESSING_CONCURRENCY;
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.floor(n);
  }
  const cpus = (() => {
    try {
      return availableParallelism();
    } catch {
      return 2;
    }
  })();
  return Math.min(4, Math.max(1, cpus));
}

const IMAGE_CONCURRENCY = parseImageConcurrency();
let imageInFlight = 0;
const imageWaitQueue: Array<() => void> = [];

async function withImageSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (imageInFlight >= IMAGE_CONCURRENCY) {
    await new Promise<void>((resolve) => imageWaitQueue.push(resolve));
  }
  imageInFlight++;
  try {
    return await fn();
  } finally {
    imageInFlight--;
    const next = imageWaitQueue.shift();
    if (next) next();
  }
}

// Bound sharp's own thread pool to the same cap so multiple concurrent
// `normalizeImage` calls can't fan out into 2× CPU's worth of libvips threads.
sharp.concurrency(IMAGE_CONCURRENCY);

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
  contentType: "image/webp" | "image/svg+xml";
  extension: "webp" | "svg";
};

/**
 * Detect whether a Buffer looks like SVG XML. We have to inspect bytes — the
 * client-supplied MIME and extension cannot be trusted (polyglot risk).
 */
function looksLikeSvg(input: Buffer): boolean {
  // SVG can have a leading XML prolog or whitespace/BOM. Scan the first 1KB.
  const head = input
    .subarray(0, Math.min(input.byteLength, 1024))
    .toString("utf8")
    .replace(/^\uFEFF/, "")
    .trimStart()
    .toLowerCase();
  return (
    head.startsWith("<?xml") ||
    head.startsWith("<svg") ||
    head.startsWith("<!doctype svg")
  );
}

/**
 * Sanitize an SVG buffer by parsing it through DOMPurify in a JSDOM
 * environment and stripping any <script>, on* event handlers, foreignObject,
 * external references, etc. — the standard XSS surface for inline SVG.
 *
 * DOMPurify is the industry-standard implementation; rolling our own regex
 * sanitizer is a known-bad idea (parser differentials between sanitizer and
 * browser have produced real CVEs).
 */
async function sanitizeSvg(input: Buffer): Promise<Buffer> {
  const { default: DOMPurify } = await import("isomorphic-dompurify");
  const dirty = input.toString("utf8");
  const clean = DOMPurify.sanitize(dirty, {
    USE_PROFILES: { svg: true, svgFilters: true },
    // Belt-and-braces: even if the profile would allow them, we don't.
    FORBID_TAGS: ["script", "foreignObject", "iframe"],
    FORBID_ATTR: ["onload", "onerror", "onclick", "onmouseover"],
  });
  if (!clean || !clean.includes("<svg")) {
    throw new Error("فرمت تصویر پشتیبانی نمی‌شود.");
  }
  return Buffer.from(clean, "utf8");
}

/**
 * Normalize arbitrary user-supplied image bytes into a safe, re-encoded image.
 *
 * WHY: trusting the uploaded MIME/extension is unsafe.
 *   - SVG is XML and can contain <script> / external resources -> stored XSS
 *     when served inline. We sanitize via DOMPurify and keep the SVG as-is
 *     (no rasterization — vectors stay vectors, no size change).
 *   - EXIF metadata on avatars often contains GPS coordinates (PII leak); sharp
 *     strips it by default on re-encode.
 *   - Re-encoding through a decoder also detects polyglot files (e.g. a PHP
 *     file renamed .jpg) which would otherwise sit in our bucket.
 *   - HEIC/HEIF (iPhone camera roll) is decoded by libheif via sharp and
 *     re-encoded to WebP, so non-Safari browsers can render it.
 *   - Pixel-dimension cap mitigates decode-bomb DoS.
 */
async function normalizeImage(
  input: Buffer,
  folder: UploadFolder,
): Promise<NormalizedImage> {
  if (input.byteLength === 0) {
    throw new Error("تصویر خالی است.");
  }
  if (input.byteLength > MAX_INPUT_BYTES) {
    throw new Error("حجم تصویر باید کمتر از ۸ مگابایت باشد.");
  }

  // SVG path: sanitize and pass through unchanged. We never raster SVG —
  // resolution-independence is the whole point of vectors.
  if (looksLikeSvg(input)) {
    const buffer = await sanitizeSvg(input);
    return { buffer, contentType: "image/svg+xml", extension: "svg" };
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
    // Reject anything that smelled like SVG but didn't pass the prefix check,
    // and any other vector formats sharp may surface.
    throw new Error("فرمت تصویر پشتیبانی نمی‌شود.");
  }

  if (
    (metadata.width ?? 0) > MAX_IMAGE_DIMENSION * 4 ||
    (metadata.height ?? 0) > MAX_IMAGE_DIMENSION * 4
  ) {
    throw new Error("ابعاد تصویر بیش از حد مجاز است.");
  }

  // Avatars are always rendered into a fixed 200×200 circular slot in the UI.
  // The cropper has already enforced 1:1, so center-cover just downscales.
  if (folder === "avatars") {
    const buffer = await pipeline
      .resize(200, 200, { fit: "cover", position: "centre" })
      .webp({ quality: 85 })
      .toBuffer();
    return { buffer, contentType: "image/webp", extension: "webp" };
  }

  // Everything else: cap dimensions and convert to WebP. WebP supports alpha,
  // so we no longer need a PNG fallback path; modern browsers all decode it.
  pipeline = pipeline.resize({
    width: MAX_IMAGE_DIMENSION,
    height: MAX_IMAGE_DIMENSION,
    fit: "inside",
    withoutEnlargement: true,
  });
  const hasAlpha = metadata.hasAlpha === true;
  const buffer = await pipeline
    .webp({ quality: hasAlpha ? 88 : 82, effort: 4, alphaQuality: 90 })
    .toBuffer();
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
    throw new Error("حجم تصویر باید کمتر از ۸ مگابایت باشد.");
  }

  const input = Buffer.from(await file.arrayBuffer());
  const normalized = await withImageSlot(() => normalizeImage(input, folder));

  const fileName = `${Date.now()}-${randomUUID()}.${normalized.extension}`;
  return putBuffer(folder, fileName, normalized.buffer, normalized.contentType);
}

export type MediaUploadResult = UploadResult & { byteSize: number };

/**
 * Upload a non-image media file (video or PDF) to the public "media" folder.
 *
 * Unlike `uploadPublicImage`, the bytes are stored verbatim — there is no
 * sharp re-encode for video/PDF. Security therefore rests entirely on:
 *   1. an extension whitelist (executables and anything off-list are rejected),
 *   2. a magic-byte sniff confirming the bytes match the claimed format, and
 *   3. a hard byte ceiling (`MAX_MEDIA_FILE_BYTES`) as a backstop.
 *
 * Per-plan size caps are enforced earlier (in media-block-service against the
 * registry); this function is the storage-layer boundary. Returns the stored
 * URL plus `byteSize` so the caller can account it against the page's quota.
 * Throws a Persian error on any rejection so the UI can show it directly.
 */
export async function uploadPublicFile(
  file: File,
  kind: MediaFileKind,
): Promise<MediaUploadResult | null> {
  if (file.size === 0) return null;
  if (file.size > MAX_MEDIA_FILE_BYTES) {
    throw new Error("حجم فایل بیش از حد مجاز است.");
  }

  const ext = fileExtension(file.name);
  const allowed = MEDIA_EXTENSION_WHITELIST[kind] as readonly string[];
  if (!allowed.includes(ext)) {
    throw new Error(
      kind === "video"
        ? "فقط فایل ویدئویی با فرمت mp4 یا mov پشتیبانی می‌شود."
        : "فقط فایل PDF پشتیبانی می‌شود.",
    );
  }

  const input = Buffer.from(await file.arrayBuffer());
  const detected = detectMediaFormat(input);
  if (!detected) {
    throw new Error("محتوای فایل با فرمت آن مطابقت ندارد.");
  }
  // The sniffed format must belong to the requested kind. (mov is sniffed as
  // either mov or mp4 depending on brand; accept both under the video kind.)
  const detectedKind: MediaFileKind = detected === "pdf" ? "file" : "video";
  if (detectedKind !== kind) {
    throw new Error("محتوای فایل با فرمت آن مطابقت ندارد.");
  }

  const contentType =
    detected === "pdf"
      ? "application/pdf"
      : (MEDIA_VIDEO_CONTENT_TYPE[ext] ?? "video/mp4");
  const fileName = `${Date.now()}-${randomUUID()}.${ext}`;
  const stored = await putBuffer("media", fileName, input, contentType);
  return { ...stored, byteSize: input.byteLength };
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
    const normalized = await withImageSlot(() =>
      normalizeImage(fetched.body, folder),
    );
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

/**
 * Delete a previously uploaded public image by its URL.
 * Silently does nothing if the URL is not recognised as one of ours.
 */
export async function deletePublicImage(url: string): Promise<void> {
  const cfg = getS3Config();
  if (cfg) {
    const prefix = cfg.publicBase + "/";
    if (!url.startsWith(prefix)) return;
    const key = url.slice(prefix.length);
    try {
      await getS3Client(cfg).send(
        new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }),
      );
    } catch {
      // Non-critical — the row is already being nulled in the DB.
    }
  } else {
    // Local filesystem storage.
    if (!url.startsWith("/uploads/")) return;
    const filePath = path.join(process.cwd(), "public", url);
    try {
      await unlink(filePath);
    } catch {
      // File may already be gone.
    }
  }
}

// ---------------------------------------------------------------------------
// Private uploads (payment receipts)
// ---------------------------------------------------------------------------
// Receipts are financial PII. Unlike covers/avatars they are NEVER public:
//   - S3: uploaded with `ACL: private`, served via short-lived presigned
//     GetObject URLs minted only inside owner-gated server code.
//   - Local dev (no S3 configured): written OUTSIDE `public/` so Next never
//     serves them statically; an owner-gated route handler streams the bytes.
// Callers store the returned `key` on the registration (never a URL), and
// resolve it to a viewable URL through `getPrivateObjectSignedUrl` at render.

const PRIVATE_FOLDER = "event-receipts" as const;
const SIGNED_URL_TTL_SECONDS = 60 * 5;

/** Absolute on-disk dir for local-dev private storage (outside public/). */
function localPrivateDir(): string {
  return path.join(process.cwd(), ".private-uploads", PRIVATE_FOLDER);
}

/**
 * Upload a payment-receipt image privately. Re-encodes through the same
 * `normalizeImage` pipeline (strips EXIF/GPS, caps dimensions, neutralizes
 * polyglot/SVG-XSS) using the generic image profile. Returns the storage
 * `key` to persist — NOT a public URL.
 */
export async function uploadPrivateImage(file: File): Promise<string | null> {
  if (file.size === 0) return null;
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("حجم تصویر باید کمتر از ۸ مگابایت باشد.");
  }

  const input = Buffer.from(await file.arrayBuffer());
  // Use the "events" profile purely for sizing — it routes through the
  // generic (non-avatar) re-encode path.
  const normalized = await withImageSlot(() => normalizeImage(input, "events"));
  const fileName = `${Date.now()}-${randomUUID()}.${normalized.extension}`;
  const key = `${PRIVATE_FOLDER}/${fileName}`;

  const cfg = getS3Config();
  if (cfg) {
    await getS3Client(cfg).send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
        Body: normalized.buffer,
        ContentType: normalized.contentType,
        ACL: "private",
        CacheControl: "private, no-store",
      }),
    );
    return key;
  }

  // Local dev: write outside public/.
  await mkdir(localPrivateDir(), { recursive: true });
  await writeFile(path.join(localPrivateDir(), fileName), normalized.buffer);
  return key;
}

/**
 * Resolve a private receipt `key` to a viewable URL. On S3 this is a
 * short-lived presigned GetObject URL; in local dev it's the owner-gated
 * route that streams the file. MUST only be called from server code that has
 * already authorized the viewer (event host or admin).
 */
export async function getPrivateObjectSignedUrl(
  key: string,
): Promise<string | null> {
  if (!key) return null;
  const cfg = getS3Config();
  if (cfg) {
    // getSignedUrl's client param is a smithy `Client<...>`; S3Client satisfies
    // it structurally but TS flags the private `handlers` field across the
    // smithy type copies. Narrow via the presigner's own parameter type.
    const url = await getSignedUrl(
      getS3Client(cfg) as unknown as Parameters<typeof getSignedUrl>[0],
      new GetObjectCommand({ Bucket: cfg.bucket, Key: key }),
      { expiresIn: SIGNED_URL_TTL_SECONDS },
    );
    return url;
  }
  // Local dev: route handler at /api/private/receipt streams it.
  const fileName = key.startsWith(`${PRIVATE_FOLDER}/`)
    ? key.slice(PRIVATE_FOLDER.length + 1)
    : key;
  return `/api/private/receipt?file=${encodeURIComponent(fileName)}`;
}

/**
 * Read a local-dev private receipt's bytes by file name (no path segments).
 * Returns null if S3 is configured (local path doesn't apply) or missing.
 * Only called by the owner-gated route handler.
 */
export async function readLocalPrivateReceipt(
  fileName: string,
): Promise<Buffer | null> {
  if (getS3Config()) return null;
  // Defense-in-depth: reject anything that isn't a bare file name.
  if (!/^[A-Za-z0-9._-]+$/.test(fileName) || fileName.includes("..")) {
    return null;
  }
  try {
    const { readFile } = await import("node:fs/promises");
    return await readFile(path.join(localPrivateDir(), fileName));
  } catch {
    return null;
  }
}

/** Delete a private object by key (S3 or local). Best-effort. */
export async function deletePrivateObject(key: string): Promise<void> {
  if (!key) return;
  const cfg = getS3Config();
  if (cfg) {
    try {
      await getS3Client(cfg).send(
        new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }),
      );
    } catch {
      // Non-critical.
    }
    return;
  }
  const fileName = key.startsWith(`${PRIVATE_FOLDER}/`)
    ? key.slice(PRIVATE_FOLDER.length + 1)
    : key;
  try {
    await unlink(path.join(localPrivateDir(), fileName));
  } catch {
    // Already gone.
  }
}
