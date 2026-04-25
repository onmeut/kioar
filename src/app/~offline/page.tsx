import Link from "next/link";
import { WifiOffIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

export default function OfflinePage() {
  return (
    <main className="section-shell flex min-h-dvh items-center justify-center py-16">
      <div className="surface-card max-w-md space-y-4 p-6 text-center sm:p-8">
        <div className="mx-auto flex size-14 items-center justify-center rounded-4xl bg-primary/10 text-primary">
          <WifiOffIcon className="size-6" />
        </div>
        <h1 className="text-2xl font-bold">اتصال شما قطع شده است</h1>
        <p className="text-sm leading-7 text-muted-foreground">
          برخی صفحه‌های بازدیدشده هنوز در دسترس هستند. بعد از اتصال دوباره،
          برنامه به‌صورت خودکار به‌روزرسانی می‌شود.
        </p>
        <Link
          href="/"
          className={buttonVariants({
            size: "lg",
            className: "w-full rounded-full",
          })}
        >
          بازگشت به خانه
        </Link>
      </div>
    </main>
  );
}
