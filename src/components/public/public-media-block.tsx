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

function Caption({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p className="mt-2 px-1 text-[13px] leading-6 text-muted-foreground">
      {text}
    </p>
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
          <span className="block w-full overflow-hidden rounded-2xl bg-muted">
            <Image
              src={p.url}
              alt={block.name ?? ""}
              width={640}
              height={640}
              sizes="(max-width: 640px) 100vw, 640px"
              className="h-auto w-full object-cover"
              unoptimized
            />
          </span>
          <Caption text={block.caption} />
        </div>
      );
    }

    return (
      <div className="w-full">
        <div
          className={cn(
            "flex snap-x snap-mandatory gap-2.5 overflow-x-auto pb-1 no-scrollbar touch-pan-y",
            // The trailing padding lets the last slide rest with a hint of
            // empty space; each slide is 82% so the next image peeks.
          )}
        >
          {photos.map((p) => (
            <span
              key={p.id}
              className="relative aspect-square w-[82%] shrink-0 snap-start overflow-hidden rounded-2xl bg-muted"
            >
              <Image
                src={p.url}
                alt=""
                fill
                sizes="82vw"
                className="object-cover"
                unoptimized
              />
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
