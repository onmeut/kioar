"use client";

import Link from "next/link";
import { WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-muted px-4 py-16">
      <div className="flex w-full max-w-sm flex-col items-center gap-8 text-center">
        {/* Icon */}
        <div className="flex size-16 items-center justify-center rounded-3xl border border-border bg-muted text-muted-foreground">
          <WifiOff className="size-7" />
        </div>

        {/* Copy */}
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-bold leading-snug text-foreground">
            اتصال اینترنت برقرار نیست
          </h1>
          <p className="text-sm leading-7 text-muted-foreground">
            به‌نظر می‌رسه الان آنلاین نیستی یا شایدم فیلترشکنت روشنه،
          </p>
        </div>

        {/* Actions */}
        <div className="flex w-full flex-col gap-3">
          <Button
            size="lg"
            className="w-full"
            onClick={() => window.location.reload()}
          >
            تلاش دوباره
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="w-full"
            render={<Link href="/" />}
          >
            بازگشت به خانه
          </Button>
        </div>
      </div>
    </main>
  );
}
