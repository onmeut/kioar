import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="section-shell flex min-h-dvh items-center justify-center py-16">
      <div className="surface-card max-w-md space-y-4 p-6 text-center sm:p-8">
        <p className="text-sm font-semibold text-primary">۴۰۴</p>
        <h1 className="text-2xl font-bold">این صفحه پیدا نشد</h1>
        <p className="text-sm leading-7 text-muted-foreground">
          آدرسی که دنبال آن بودید وجود ندارد یا حذف شده است.
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
