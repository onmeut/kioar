import { SmartphoneIcon } from "lucide-react";

import { renderQrSvg } from "@/lib/qr/render-svg";
import { DEFAULT_QR_STYLE, type QrStyle } from "@/lib/qr/types";

export async function DesktopMobileQr({
  url,
  qrStyle,
}: {
  url: string;
  qrStyle?: QrStyle | null;
}) {
  const style = qrStyle ?? DEFAULT_QR_STYLE;
  const svg = renderQrSvg({ text: url, style, background: "#ffffff" });

  return (
    <aside
      dir="rtl"
      className="pointer-events-auto fixed bottom-6 z-40 hidden lg:block inset-e-6"
      aria-label="مشاهده روی موبایل"
    >
      <div className="flex items-center gap-3 rounded-[1.5rem] border bg-card/95 p-3 shadow-[0_10px_30px_-12px_rgba(15,23,42,0.25),0_30px_60px_-24px_rgba(15,23,42,0.2)] backdrop-blur">
        <div
          className="size-24 shrink-0 overflow-hidden rounded-2xl bg-white"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <div className="flex max-w-40 flex-col text-start">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
            <SmartphoneIcon className="size-3.5" />
            مشاهده روی موبایل
          </span>
          <span className="mt-1 text-[12.5px] font-bold leading-5 text-foreground">
            این QR را با دوربین موبایل اسکن کنید
          </span>
        </div>
      </div>
    </aside>
  );
}
