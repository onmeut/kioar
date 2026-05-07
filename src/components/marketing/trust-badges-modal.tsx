"use client";

import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function TrustBadgesModal({ variant }: { variant?: "dark" }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          variant === "dark"
            ? "transition-colors hover:text-white"
            : "transition-colors hover:text-ink"
        }
      >
        نمادها
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>نمادها و گواهی‌نامه‌ها</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 pt-2">
            {/* eNamad */}
            <div className="flex items-center justify-center rounded-xl border border-hairline p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <a
                referrerPolicy="origin"
                target="_blank"
                href="https://trustseal.enamad.ir/?id=724719&Code=XXjmUO742uWN3DdXHYA0akCPqwErlcEm"
              >
                <img
                  referrerPolicy="origin"
                  src="https://trustseal.enamad.ir/logo.aspx?id=724719&Code=XXjmUO742uWN3DdXHYA0akCPqwErlcEm"
                  alt="نماد اعتماد الکترونیکی"
                  style={{ cursor: "pointer" }}
                  {...({ code: "XXjmUO742uWN3DdXHYA0akCPqwErlcEm" } as Record<
                    string,
                    unknown
                  >)}
                />
              </a>
            </div>

            {/* Samandehi */}
            <div className="flex items-center justify-center rounded-xl border border-hairline p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/credentials/samandehi.png"
                alt="نشان ملی ثبت رسانه‌های دیجیتال - ساماندهی"
                className="max-h-24 w-auto object-contain"
              />
            </div>

            {/* Computer Guild */}
            <div className="flex items-center justify-center rounded-xl border border-hairline p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/credentials/computer-guild.png"
                alt="سازمان نظام صنفی رایانه‌ای کشور"
                className="max-h-24 w-auto object-contain"
              />
            </div>

            {/* Danesh Bonyad */}
            <div className="flex items-center justify-center rounded-xl border border-hairline p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/credentials/danesh-bonyad.png"
                alt="شرکت دانش بنیان"
                className="max-h-24 w-auto object-contain"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
