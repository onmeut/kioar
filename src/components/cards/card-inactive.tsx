import Link from "next/link";

/**
 * Shown for `/c/{id}` when the card is disabled, the id is malformed/unknown,
 * or its bound page has gone away. Deliberately vague — we don't reveal whether
 * an id exists, to keep enumeration uninteresting.
 */
export function CardInactive({ rateLimited = false }: { rateLimited?: boolean }) {
  return (
    <main
      dir="rtl"
      className="flex min-h-dvh items-center justify-center bg-muted px-4 text-center"
    >
      <div className="max-w-sm space-y-4">
        <p className="text-4xl">{rateLimited ? "⏳" : "🪪"}</p>
        <h1 className="text-xl font-bold text-foreground">
          {rateLimited ? "کمی صبر کنید" : "این کارت فعال نیست"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {rateLimited
            ? "تعداد درخواست‌ها زیاد بود. چند لحظه بعد دوباره تلاش کنید."
            : "این کارت غیرفعال شده یا هنوز به صفحه‌ای متصل نشده است. اگر صاحب این کارت هستید، از داشبورد کی‌یو‌آر آن را مدیریت کنید."}
        </p>
        <Link
          href="https://kioar.com"
          className="tap-target inline-flex h-11 items-center justify-center rounded-full bg-foreground px-6 text-sm font-medium text-background"
        >
          رفتن به کی‌یو‌آر
        </Link>
      </div>
    </main>
  );
}
