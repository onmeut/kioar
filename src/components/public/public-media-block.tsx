import Image from "next/image";
import { DownloadIcon, FileTextIcon } from "lucide-react";

import { PublicMediaVideo } from "@/components/public/public-media-video";
import { parseVideoEmbed } from "@/lib/media-embed";
import { toPersianDigits } from "@/lib/date/persian";
import { cn } from "@/lib/utils";

export type PublicMediaItemData = {
  id: string;
  kind: "image" | "video" | "file";
  url: string;
  byteSize: number;
  mime: string | null;
  displayName: string | null;
  thumbnailUrl: string | null;
  aspectRatioW: number | null;
  aspectRatioH: number | null;
  cropX: number | null;
  cropY: number | null;
  cropW: number | null;
  cropH: number | null;
};

export type PublicMediaBlockData = {
  id: string;
  mode: "photos" | "video" | "file";
  name: string | null;
  caption: string | null;
  videoUrl: string | null;
  items: PublicMediaItemData[];
  sortOrder?: number;
};

/** Human-friendly file size in Persian digits (KB / MB). */
function formatFileSize(bytes: number): string {
  if (bytes <= 0) return "";
  if (bytes < 1_000_000) {
    return `${toPersianDigits(Math.max(1, Math.round(bytes / 1000)))} کیلوبایت`;
  }
  const mb = bytes / 1_000_000;
  return `${toPersianDigits(mb.toFixed(mb < 10 ? 1 : 0))} مگابایت`;
}

function BlockTitle({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p className="mb-2 px-1 text-[15px] font-bold text-foreground">{text}</p>
  );
}

function Caption({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p className="mt-2 px-1 text-[13px] leading-6 text-muted-foreground">
      {text}
    </p>
  );
}

/**
 * Renders one gallery image inside its fixed-height container.
 *
 * The container is `position: relative; overflow: hidden` with a fixed
 * padding-bottom aspect ratio (set by the caller). This component positions
 * the image inside that container.
 *
 * With a crop: the image is made `1/cropW × 1/cropH` times larger than the
 * container (so the crop window fills it exactly) and offset so the crop
 * window's top-left aligns with the container's top-left.
 *
 * Without a crop: the image uses object-cover to fill the container
 * (letterboxed for off-ratio images — the excess is clipped).
 */
function GalleryImage({
  photo,
  sizes,
  alt,
}: {
  photo: PublicMediaItemData;
  sizes: string;
  alt: string;
}) {
  const hasCrop =
    photo.cropX !== null &&
    photo.cropY !== null &&
    photo.cropW !== null &&
    photo.cropH !== null &&
    (photo.cropW ?? 0) > 0 &&
    (photo.cropH ?? 0) > 0;

  if (hasCrop) {
    // Render the full image inside an oversized absolutely-positioned wrapper,
    // then let the parent's overflow:hidden clip it to the crop window.
    // scaleW/H = how many times larger than the container the full image is.
    const scaleW = 1 / photo.cropW!;
    const scaleH = 1 / photo.cropH!;
    const leftPct = -(photo.cropX! * scaleW) * 100;
    const topPct = -(photo.cropY! * scaleH) * 100;
    return (
      <span
        style={{
          position: "absolute",
          width: `${scaleW * 100}%`,
          height: `${scaleH * 100}%`,
          left: `${leftPct}%`,
          top: `${topPct}%`,
        }}
      >
        <Image
          src={photo.url}
          alt={alt}
          fill
          sizes={sizes}
          style={{ objectFit: "fill" }}
          unoptimized
        />
      </span>
    );
  }

  return (
    <Image
      src={photo.url}
      alt={alt}
      fill
      sizes={sizes}
      className="object-cover"
      unoptimized
    />
  );
}

/**
 * Public renderer for a media block. One component, three modes:
 *  - photos: 1 → full-width image; N → horizontal swipeable gallery (the next
 *    image peeks to signal swipe).
 *  - video: pasted YouTube/Aparat embed OR an uploaded muted-autoplay file.
 *  - file: a tappable download/view card.
 * RTL, mobile-first, solid colors only.
 */
export function PublicMediaBlock({
  block,
  interactive = true,
}: {
  block: PublicMediaBlockData;
  interactive?: boolean;
}) {
  if (block.mode === "photos") {
    const photos = block.items.filter((it) => it.kind === "image");
    if (!photos.length) return null;

    if (photos.length === 1) {
      const p = photos[0];
      return (
        <div className="w-full">
          <BlockTitle text={block.name} />
          <span
            className="relative block w-full overflow-hidden rounded-2xl bg-muted"
            style={{ aspectRatio: "4 / 5" }}
          >
            <GalleryImage photo={p} sizes="(max-width: 640px) 100vw, 640px" alt={block.name ?? ""} />
          </span>
          <Caption text={block.caption} />
        </div>
      );
    }

    return (
      <div className="w-full">
        <BlockTitle text={block.name} />
        <div className="flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1 no-scrollbar touch-pan-x">
          {photos.map((p) => (
            <span
              key={p.id}
              className="relative w-[82%] shrink-0 snap-start overflow-hidden rounded-2xl bg-muted"
              style={{ aspectRatio: "4 / 5" }}
            >
              <GalleryImage photo={p} sizes="82vw" alt="" />
            </span>
          ))}
        </div>
        <Caption text={block.caption} />
      </div>
    );
  }

  if (block.mode === "video") {
    // Pasted embed takes precedence; otherwise an uploaded file.
    if (block.videoUrl) {
      const embed = parseVideoEmbed(block.videoUrl);
      if (embed) {
        return (
          <div className="w-full">
            <BlockTitle text={block.name} />
            <span className="block aspect-video w-full overflow-hidden rounded-2xl bg-black">
              {interactive ? (
                <iframe
                  src={embed.embedUrl}
                  title={block.name ?? "ویدئو"}
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              ) : null}
            </span>
            <Caption text={block.caption} />
          </div>
        );
      }
      return null;
    }
    const videoItem = block.items.find((it) => it.kind === "video");
    if (!videoItem) return null;
    return (
      <div className="w-full">
        <BlockTitle text={block.name} />
        <PublicMediaVideo
          src={videoItem.url}
          posterUrl={videoItem.thumbnailUrl}
        />
        <Caption text={block.caption} />
      </div>
    );
  }

  // mode === "file"
  const file = block.items.find((it) => it.kind === "file");
  if (!file) return null;
  const label = file.displayName || block.name || "دانلود فایل";
  const sizeLabel = formatFileSize(file.byteSize);

  const inner = (
    <>
      <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <FileTextIcon className="size-5.5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col text-start">
        <span className="truncate text-[15px] font-bold text-foreground">
          {label}
        </span>
        {sizeLabel ? (
          <span className="text-[12px] text-muted-foreground">{sizeLabel}</span>
        ) : null}
      </span>
      <DownloadIcon className="size-5 shrink-0 text-muted-foreground" />
    </>
  );

  const base =
    "tap-target flex w-full items-center gap-3 rounded-2xl bg-foreground/4 px-4 py-3 transition-colors";

  return (
    <div className="w-full">
      {interactive ? (
        <a
          href={file.url}
          target="_blank"
          rel="nofollow noopener noreferrer"
          // `download` hints a save; mobile browsers open PDFs in the native
          // viewer either way. The display name becomes the saved file name.
          download={file.displayName ?? undefined}
          className={cn(base, "hover:bg-primary/8 active:bg-primary/12")}
        >
          {inner}
        </a>
      ) : (
        <span className={base} aria-disabled>
          {inner}
        </span>
      )}
      <Caption text={block.caption} />
    </div>
  );
}
