/**
 * `/affiliate/dashboard/resources` — share kit + brand assets + tips.
 */
import Image from "next/image";
import Link from "next/link";

import {
  DownloadIcon,
  GraduationCapIcon,
  LightbulbIcon,
  MessageCircleIcon,
} from "lucide-react";

import { CopyableSnippet } from "@/app/affiliate/dashboard/resources/copyable-snippet";
import { getAffiliateStateForUser } from "@/lib/affiliate";
import { requireUser } from "@/lib/auth/session";
import { absoluteUrl } from "@/lib/site";

export default async function AffiliateResourcesPage() {
  const viewer = await requireUser();
  const state = await getAffiliateStateForUser(viewer.user.id);
  const code = state.kind === "approved" ? state.code : "YOUR_CODE";
  const link = absoluteUrl(`/r/${code}`);

  const snippets: { title: string; text: string }[] = [
    {
      title: "تلگرام / واتس‌اپ — کوتاه",
      text:
        `یه کارت ویزیت دیجیتال خفن با همه‌ی لینک‌هات یه‌جا. روی این لینک ` +
        `بساز، ۳ ماه پروی رایگان هم می‌گیری 👇\n${link}`,
    },
    {
      title: "اینستاگرام / استوری",
      text:
        `لینک‌بایو فارسی، طراحی تمیز، بدون تبلیغ. الان از طریق این لینک ثبت‌نام ` +
        `کن، اگه پلن سالانه‌ی پرو بگیری ۳ ماه رایگان هدیه می‌گیری.\n${link}`,
    },
    {
      title: "توییتر / X",
      text:
        `Kioar — کارت ویزیت دیجیتال فارسی برای کسب‌وکارها و خلاق‌ها. سریع، ` +
        `مدرن، با کلی ابزار توی پنل. از این لینک امتحان کن: ${link}`,
    },
    {
      title: "بیو / لینک‌بایو خودت",
      text: `کارت ویزیت دیجیتالم با Kioar ساخته شده — تو هم بساز:\n${link}`,
    },
    {
      title: "ایمیل / خبرنامه",
      text:
        `سلام،\n\nیه ابزار خوب پیدا کردم برای ساختن کارت ویزیت دیجیتال و صفحه‌ی ` +
        `لینک‌بایو فارسی به اسم Kioar. طراحی تمیز، رزرو نوبت، فرم تماس و کلی ` +
        `قابلیت دیگه داره. از این لینک ثبت‌نام کنی، اگه پلن سالانه‌ی پرو بگیری ` +
        `۳ ماه پروی رایگان می‌گیری:\n\n${link}\n\nموفق باشی.`,
    },
    {
      title: "بلاگ / مقاله — هوک افتتاحیه",
      text:
        `اگه دنبال یه راه ساده برای جمع‌کردن همه‌ی لینک‌هاتون توی یه صفحه‌ی ` +
        `حرفه‌ای فارسی هستین، Kioar یکی از بهترین انتخاب‌هاست. این لینک رو ` +
        `استفاده کنید تا با تخفیف ۳ ماه رایگان شروع کنید: ${link}`,
    },
  ];

  return (
    <div className="space-y-10">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-violet-700">
          منابع و کیت برند
        </p>
        <h1 className="mt-1 text-[clamp(22px,3.5vw,30px)] font-semibold tracking-tight">
          هرچی برای پخش لینک نیاز داری
        </h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-7 text-ink-soft">
          لینک اختصاصی، متن‌های آماده برای کانال‌های مختلف، و فایل‌های گرافیکی.
          هر چیزی که بخوای، فقط کپی کن و بفرست.
        </p>
      </div>

      {/* Tips */}
      <section className="grid gap-4 sm:grid-cols-3">
        <Tip
          icon={LightbulbIcon}
          title="درباره‌ی محصول صادق باش"
          body="وعده‌ی نادرست نده. هر کاربر ناراضی برابره با ریسک کم شدن نرخ تبدیل بلندمدتت."
        />
        <Tip
          icon={MessageCircleIcon}
          title="با مخاطب هدف صحبت کن"
          body="اگه مخاطبت کسب‌وکار محلیه، روی رزرو نوبت تأکید کن. اگه خلاق محتوا داری، روی لینک‌بایو."
        />
        <Tip
          icon={GraduationCapIcon}
          title="ویدیو > متن"
          body="نمایش زنده‌ی ساخت یه پنل در عرض ۳۰ ثانیه از هر متنی قوی‌تره."
        />
      </section>

      {/* Snippets */}
      <section>
        <h2 className="mb-3 text-[16px] font-semibold tracking-tight">
          متن‌های آماده
        </h2>
        <p className="mb-4 text-[12px] leading-6 text-ink-soft">
          هر متن لینک اختصاصی تو رو داره. مستقیم کپی کن.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {snippets.map((s) => (
            <CopyableSnippet key={s.title} title={s.title} text={s.text} />
          ))}
        </div>
      </section>

      {/* Brand kit */}
      <section className="rounded-3xl border border-hairline bg-paper-soft p-6">
        <h2 className="text-[16px] font-semibold tracking-tight">کیت برند</h2>
        <p className="mt-1 max-w-xl text-[12px] leading-6 text-ink-soft">
          لوگو و آیکن‌ کی‌یو‌آر برای استفاده در محتوای تبلیغاتی. لطفاً لوگو رو
          بدون تغییر شکل، رنگ یا چرخش استفاده کن.
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-2">
          <BrandTile
            label="لوگوی روشن"
            href="/brand/logo.svg"
            preview="/brand/logo.svg"
          />
          <BrandTile
            label="لوگوی تیره"
            href="/brand/logo-white.svg"
            preview="/brand/logo-white.svg"
            dark
          />
        </div>
      </section>

      {/* Guidelines */}
      <section className="rounded-3xl border border-amber-200 bg-amber-50/60 p-6">
        <h2 className="text-[15px] font-semibold tracking-tight text-amber-950">
          قوانین تبلیغات
        </h2>
        <ul className="mt-3 space-y-2 text-[13px] leading-7 text-amber-950/90">
          <li>• تبلیغ توی موتورهای جستجو با برند Kioar مجاز نیست.</li>
          <li>
            • از کوپن‌ها یا کش‌بک‌های جعلی استفاده نکن. هر چیزی که بهش وعده دادی
            باید واقعی باشه.
          </li>
          <li>• از اسپم پیامکی یا ایمیلی استفاده نکن.</li>
          <li>
            • محتوای جعل هویت، فریب‌کارانه یا ویروسی ممنوعه. حساب همکاری بسته
            می‌شه.
          </li>
          <li>
            • خرید با حساب خودت یا حساب نزدیکانت تقلب محسوب می‌شه و پورسانت باطل
            می‌شه.
          </li>
        </ul>
        <Link
          href="/affiliate"
          className="mt-4 inline-block text-[12px] font-bold text-violet-700 hover:underline"
        >
          مشاهده‌ی کامل شرایط همکاری ←
        </Link>
      </section>
    </div>
  );
}

function Tip({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-hairline bg-paper p-4">
      <div className="flex size-9 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
        <Icon className="size-4" />
      </div>
      <p className="mt-3 text-[13px] font-bold text-ink">{title}</p>
      <p className="mt-1 text-[12px] leading-6 text-ink-soft">{body}</p>
    </div>
  );
}

function BrandTile({
  label,
  href,
  preview,
  dark,
  zip,
}: {
  label: string;
  href: string;
  preview?: string;
  dark?: boolean;
  zip?: boolean;
}) {
  return (
    <a
      href={href}
      download
      className="group flex flex-col overflow-hidden rounded-2xl border border-hairline bg-paper transition hover:border-ink/40"
    >
      <div
        className={`flex h-24 items-center justify-center ${
          dark ? "bg-ink" : "bg-paper-soft"
        }`}
      >
        {preview ? (
          <Image
            src={preview}
            alt={label}
            width={80}
            height={48}
            className="size-12 object-contain"
            unoptimized
          />
        ) : (
          <DownloadIcon
            className={`size-7 ${dark ? "text-paper" : "text-ink"}`}
          />
        )}
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <span className="text-[12px] font-bold text-ink">{label}</span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-soft">
          {zip ? "ZIP" : "SVG"}
        </span>
      </div>
    </a>
  );
}
