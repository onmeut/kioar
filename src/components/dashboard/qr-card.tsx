"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { CheckIcon, CopyIcon, DownloadIcon, Share2Icon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function QrCard({ url, title }: { url: string; title: string }) {
  const [dataUrl, setDataUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    QRCode.toDataURL(url, {
      margin: 2,
      width: 512,
      color: {
        dark: "#123b36",
        light: "#ffffff",
      },
    })
      .then(setDataUrl)
      .catch(() => {
        toast.error("ساخت QR با خطا مواجه شد.");
      });
  }, [url]);

  async function copyLink() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("لینک کارت کپی شد.");
    window.setTimeout(() => setCopied(false), 2000);
  }

  async function shareCard() {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          url,
        });
        return;
      } catch {
        // user dismissed share sheet
      }
    }

    await copyLink();
  }

  function downloadQr() {
    if (!dataUrl) return;

    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = "kioar-qr.png";
    anchor.click();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[1.75rem] border border-black/[0.06] bg-white p-5">
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={dataUrl}
            alt="QR code"
            className="mx-auto aspect-square w-full max-w-64 rounded-3xl"
          />
        ) : (
          <div className="mx-auto aspect-square w-full max-w-64 animate-pulse rounded-3xl bg-muted" />
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={copyLink}
        >
          {copied ? (
            <CheckIcon className="size-4" />
          ) : (
            <CopyIcon className="size-4" />
          )}
          کپی لینک
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11"
          onClick={shareCard}
        >
          <Share2Icon className="size-4" />
          اشتراک
        </Button>
        <Button
          type="button"
          className="h-11"
          onClick={downloadQr}
          disabled={!dataUrl}
        >
          <DownloadIcon className="size-4" />
        </Button>
      </div>
    </div>
  );
}
