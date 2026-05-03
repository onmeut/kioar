import Image from "next/image";
import {
  AtSign,
  BatteryFull,
  CalendarDays,
  Camera,
  Download,
  Globe,
  Home,
  Link2,
  Phone,
  Play,
  Send,
  Share2,
  User,
  Wifi,
} from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

const demoLinks = [
  { label: "اینستاگرام", icon: Camera, color: "bg-rose-500" },
  { label: "کانال تلگرام", icon: Send, color: "bg-sky-500" },
  { label: "وب‌سایت شخصی", icon: Globe, color: "bg-violet-500" },
  { label: "یوتیوب", icon: Play, color: "bg-red-500" },
];

export function ProfileMock({ className }: Props) {
  return (
    <div
      dir="ltr"
      className={cn(
        "relative w-70 overflow-hidden rounded-[44px] border border-stone-200 bg-white shadow-[0_30px_80px_-30px_rgba(0,0,0,0.18)]",
        className,
      )}
    >
      {/* device status bar */}
      <div className="flex items-center justify-between bg-white px-7 pt-3 pb-2 text-[11px] font-semibold text-stone-900">
        <span>9:41</span>
        <span className="block h-5 w-17 rounded-full bg-stone-900" />
        <span className="flex items-center gap-1">
          <SignalBars />
          <Wifi className="size-3" />
          <BatteryFull className="size-4" />
        </span>
      </div>

      {/* profile card content */}
      <div dir="rtl" className="flex flex-col bg-white px-4 pb-1">
        {/* header: kioar logo + share */}
        <div className="flex items-center justify-between py-2">
          <div className="grid size-7 place-items-center rounded-full bg-stone-100">
            <Image
              src="/brand/logo.svg"
              alt="کی‌یو‌آر"
              width={11}
              height={14}
            />
          </div>
          <div className="grid size-7 place-items-center rounded-full bg-stone-100">
            <Share2 className="size-3 text-stone-700" />
          </div>
        </div>

        {/* avatar + name + title */}
        <div className="mt-1 flex flex-col items-center text-center">
          <div className="flex size-14 items-center justify-center overflow-hidden rounded-full border border-stone-100 bg-fuchsia-100">
            <span className="text-[22px] font-bold text-fuchsia-600">س</span>
          </div>
          <p className="mt-2 text-[14px] font-bold leading-tight text-stone-900">
            سارا کریمی
          </p>
          <p className="mt-0.5 text-[10px] font-semibold text-stone-500">
            طراح گرافیک &amp; ویدئوگراف
          </p>
        </div>

        {/* quick actions */}
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {(
            [
              { icon: Phone, label: "تماس" },
              { icon: AtSign, label: "ایمیل" },
              { icon: Download, label: "ذخیره" },
            ] as const
          ).map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-1 rounded-2xl bg-stone-50 px-1 py-2"
            >
              <Icon className="size-3.5 text-stone-700" />
              <span className="text-[9px] font-semibold text-stone-500">
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* bio */}
        <div className="mt-2.5 rounded-2xl bg-stone-50 px-3 py-2">
          <p className="text-[9px] leading-[1.8] text-stone-700">
            طراحی برند، موشن‌گرافیک و عکاسی محصول. همکاری با برندهای ایرانی و
            بین‌المللی.
          </p>
        </div>

        {/* link pills */}
        <div className="mt-2.5 space-y-1.5">
          {demoLinks.map(({ label, icon: Icon, color }) => (
            <div
              key={label}
              className="relative flex w-full items-center justify-center rounded-full bg-stone-50 px-3 py-2.25"
            >
              <span
                className={cn(
                  "absolute inset-s-2 inline-flex size-5.5 items-center justify-center rounded-xl",
                  color,
                )}
              >
                <Icon className="size-3 text-white" />
              </span>
              <span className="block w-full truncate px-6 text-center text-[10px] font-bold text-stone-900">
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* footer badge */}
        <div className="mt-3 flex justify-center">
          <div className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1">
            <Image src="/brand/logo.svg" alt="" width={8} height={10} />
            <span className="text-[8px] font-semibold text-stone-700">
              ساخته‌شده با کی‌یو‌آر
            </span>
          </div>
        </div>
      </div>

      {/* PWA bottom navigation bar */}
      <div className="border-t border-stone-100 bg-white px-1 pt-2 pb-1">
        <div className="grid grid-cols-4">
          {(
            [
              { icon: Home, label: "خانه", active: true },
              { icon: Link2, label: "لینک‌ها", active: false },
              { icon: CalendarDays, label: "رویداد", active: false },
              { icon: User, label: "من", active: false },
            ] as const
          ).map(({ icon: Icon, label, active }) => (
            <div
              key={label}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-xl py-1.5",
                active ? "text-fuchsia-600" : "text-stone-400",
              )}
            >
              <Icon className={cn("size-4.5", active && "stroke-[2.5px]")} />
              <span className="text-[7px] font-semibold">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* home indicator */}
      <div className="flex justify-center bg-white py-2">
        <span className="block h-1 w-20 rounded-full bg-stone-200" />
      </div>
    </div>
  );
}

function SignalBars() {
  return (
    <span className="flex items-end gap-[1.5px]">
      {[2, 3, 4, 5].map((h) => (
        <span
          key={h}
          className="block w-0.5 rounded-[1px] bg-stone-900"
          style={{ height: `${h}px` }}
        />
      ))}
    </span>
  );
}
