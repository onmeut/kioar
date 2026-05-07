import { redirect } from "next/navigation";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ArrowUpRightIcon,
  MailIcon,
  Share2Icon,
} from "lucide-react";
import { IconBrandInstagram, IconBrandTelegram } from "@tabler/icons-react";

import { PhoneMockupFrame } from "@/components/dashboard/phone-mockup-frame";
import {
  PublicProfileCard,
  type PublicProfileCardData,
} from "@/components/public/public-profile-card";
import { TrustBadgesModal } from "@/components/marketing/trust-badges-modal";
import type { ActionState } from "@/lib/action-state";
import { getCurrentViewer } from "@/lib/auth/session";

const profilePreview = {
  fullName: "امیر رایان",
  title: "کارآفرین خلاق، عاشقِ ساختن",
  bio: "همه مسیرهای ارتباط، رزرو، سفارش، فرم‌ها و خرید من در همین صفحه جمع شده است.",
  slug: "sara",
  publicPhone: "+989121234567",
  email: "hello@kioar.com",
  avatarUrl: "/brand/brand-avatar.svg",
  avatarSeed: "sara-karimi-brand-strategist",
  links: [
    {
      id: "portfolio",
      label: "نمونه‌کارهای برندینگ",
      url: "https://kioar.com/sara/portfolio",
      description: null,
      imageUrl: null,
      iconKey: "folder",
      iconUrl: null,
      sortOrder: 3,
      spotlight: "none",
      animationStyle: null,
    },
    {
      id: "instagram",
      label: "اینستاگرام",
      url: "https://instagram.com/kioar",
      description: null,
      imageUrl: null,
      iconKey: "instagram",
      iconUrl: null,
      sortOrder: 4,
      spotlight: "none",
      animationStyle: null,
    },
    {
      id: "website",
      label: "وب‌سایت رسمی",
      url: "https://kioar.com",
      description: null,
      imageUrl: null,
      iconKey: "website",
      iconUrl: null,
      sortOrder: 6,
      spotlight: "none",
      animationStyle: null,
    },
    {
      id: "telegram",
      label: "یادداشت‌های تلگرام",
      url: "https://t.me/kioar",
      description: null,
      imageUrl: null,
      iconKey: "telegram",
      iconUrl: null,
      sortOrder: 8,
      spotlight: "none",
      animationStyle: null,
    },
  ],
  bookingBlocks: [
    {
      id: "booking",
      name: "رزرو جلسه مشاوره",
      description: "انتخاب زمان مناسب برای گفت‌وگو",
      avatarUrl: null,
      locationType: "online",
      locationAddress: null,
      meetingLink: null,
      timezone: "Asia/Tehran",
      sortOrder: 0,
      spotlight: "none",
      animationStyle: null,
      types: [
        {
          id: "booking-type",
          title: "جلسه کشف برند",
          description: "شناخت جایگاه، مخاطب و مسیر فروش",
          durationMin: 45,
          priceAmount: 0,
          priceCurrency: "IRT",
        },
      ],
    },
  ],
  formBlocks: [
    {
      id: "brand-brief",
      name: "پر کردن بریف برند",
      intro:
        "چند پاسخ کوتاه کمک می‌کند قبل از جلسه تصویر دقیق‌تری از برندت داشته باشم.",
      outro: "بریف دریافت شد؛ خیلی زود برای قدم بعدی پیام می‌دهم.",
      sortOrder: 2,
      spotlight: "none",
      animationStyle: null,
      fields: [
        {
          id: "name",
          kind: "name",
          label: "نام و نام خانوادگی",
          required: true,
          options: [],
        },
        {
          id: "email",
          kind: "email",
          label: "ایمیل",
          required: true,
          options: [],
        },
        {
          id: "brand-stage",
          kind: "dropdown",
          label: "مرحله برند",
          required: true,
          options: ["شروع مسیر", "در حال رشد", "آماده بازطراحی"],
        },
        {
          id: "challenge",
          kind: "paragraph",
          label: "بزرگ‌ترین چالش فعلی",
          required: false,
          options: [],
        },
      ],
    },
  ],
  productBlocks: [
    {
      id: "services",
      name: "پکیج‌های استراتژی برند",
      description: "خدمات منتخب برای شفاف‌سازی جایگاه، پیام و مسیر تبدیل برند.",
      preset: "services",
      layout: "cards",
      itemLabel: "خدمت",
      currency: "IRT",
      showPrices: true,
      displayMode: "pill",
      pillLabel: "خدمات برندینگ",
      iconKey: "sparkles",
      iconUrl: null,
      imageUrl: null,
      sortOrder: 1,
      spotlight: "none",
      animationStyle: null,
      sections: [
        { id: "strategy", title: "استراتژی" },
        { id: "content", title: "محتوا" },
      ],
      items: [
        {
          id: "brand-kit",
          sectionId: "strategy",
          title: "کیت جایگاه‌یابی برند",
          description: "پیام اصلی، مخاطب، لحن و ستون‌های محتوایی",
          imageUrl: null,
          priceType: "from",
          priceAmount: 48000000,
          priceAmountMax: null,
          availability: "available",
          externalUrl: null,
          badge: "محبوب",
          sku: null,
        },
        {
          id: "launch-sprint",
          sectionId: "content",
          title: "اسپرینت لانچ محتوا",
          description: "تقویم ۱۴ روزه، متن لندینگ و سناریوی معرفی",
          imageUrl: null,
          priceType: "from",
          priceAmount: 32000000,
          priceAmountMax: null,
          availability: "available",
          externalUrl: null,
          badge: "جدید",
          sku: null,
        },
      ],
    },
  ],
} satisfies PublicProfileCardData;

const footerLinks: Array<{ label: string; href: Route }> = [
  { label: "صفحات دیگران", href: "#" as Route },
  { label: "تعرفه‌ها", href: "/pricing" },
  { label: "راهنما", href: "/help" },
];

const socialLinks = [
  {
    label: "اینستاگرام کی‌یو‌آر",
    href: "https://instagram.com/kioar",
    icon: IconBrandInstagram,
  },
  {
    label: "تلگرام کی‌یو‌آر",
    href: "https://t.me/kioar",
    icon: IconBrandTelegram,
  },
  { label: "تماس با کی‌یو‌آر", href: "mailto:hello@kioar.com", icon: MailIcon },
];

async function submitLandingPreviewFormAction(
  state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  "use server";

  void state;
  void formData;
  return { status: "success", message: "پیش‌نمایش فرم با موفقیت ثبت شد." };
}

async function getLandingPreviewBookingSlotsAction(input: {
  blockId: string;
  bookingTypeId: string;
  dateIso: string;
}): Promise<{ ok: true; slots: string[] } | { ok: false; message: string }> {
  "use server";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.dateIso)) {
    return { ok: false, message: "تاریخ معتبر نیست." };
  }

  const slotHoursUtc = ["06:30", "08:00", "10:30", "13:00"];
  return {
    ok: true,
    slots: slotHoursUtc.map((time) => `${input.dateIso}T${time}:00.000Z`),
  };
}

async function submitLandingPreviewBookingAction(input: unknown) {
  "use server";

  const startsAtIso =
    typeof input === "object" &&
    input !== null &&
    "startsAtIso" in input &&
    typeof input.startsAtIso === "string"
      ? input.startsAtIso
      : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  return {
    ok: true as const,
    booking: {
      id: "landing-preview-booking",
      startsAtIso,
      endsAtIso: new Date(
        new Date(startsAtIso).getTime() + 45 * 60_000,
      ).toISOString(),
    },
  };
}

export default async function LandingPage() {
  const viewer = await getCurrentViewer();
  if (viewer) {
    redirect("/me");
  }

  const landingBackground = {
    backgroundColor: "#050605",
    backgroundImage:
      "radial-gradient(circle at 18% 22%, rgba(22, 92, 53, 0.42) 0, rgba(22, 92, 53, 0.24) 18%, rgba(22, 92, 53, 0) 42%), radial-gradient(circle at 72% 20%, rgba(10, 42, 28, 0.3) 0, rgba(10, 42, 28, 0.16) 20%, rgba(10, 42, 28, 0) 46%), radial-gradient(circle at 24% 78%, rgba(16, 63, 39, 0.32) 0, rgba(16, 63, 39, 0.14) 20%, rgba(16, 63, 39, 0) 44%), linear-gradient(180deg, #07130d 0%, #051009 28%, #040705 62%, #030403 100%)",
  } satisfies React.CSSProperties;

  return (
    <main
      className="relative min-h-dvh overflow-x-hidden text-white md:min-h-dvh"
      style={landingBackground}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute inset-x-0 top-0 h-64 bg-[#07170f] opacity-70 blur-3xl" />

        <div className="absolute -top-32 inset-e-[-18%] h-[68dvh] w-[54vw] rotate-12 rounded-[32%] bg-[#082318] opacity-68 blur-3xl" />
        <div className="absolute inset-s-[-12%] top-14 h-[66dvh] w-[48vw] -rotate-12 rounded-[34%] bg-[#0f2f1d] opacity-38 blur-3xl" />
        <div className="absolute inset-x-0 bottom-[-18dvh] h-[44dvh] bg-[#07130d]/40 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-dvh w-full max-w-270 flex-col px-5 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6 md:min-h-dvh md:py-4 lg:py-5">
        <header className="flex h-11 shrink-0 items-center justify-between gap-4 text-white/70">
          <Link
            href="/"
            aria-label="کی‌یو‌آر"
            className="inline-flex tap-target items-center rounded-full text-white transition-opacity hover:opacity-80"
          >
            <Image
              src="/brand/logo-white.svg"
              alt=""
              width={22}
              height={25}
              priority
              style={{ width: "22px", height: "25px" }}
            />
          </Link>

          <nav className="flex items-center gap-3 text-xs font-semibold sm:text-sm">
            <a
              href="#"
              className="hidden items-center gap-1 text-white/80 transition-colors hover:text-white md:inline-flex"
            >
              <span>صفحات دیگران</span>
              <ArrowUpRightIcon className="size-3.5" />
            </a>
            <Link
              href="/auth"
              className="inline-flex h-9 items-center justify-center rounded-full border border-white/10 bg-white/10 px-4 text-white transition-colors hover:bg-white/16"
            >
              ورود
            </Link>
          </nav>
        </header>

        <div className="grid flex-1 items-center gap-9 pt-10 md:min-h-0 md:grid-cols-[minmax(0,1fr)_minmax(300px,360px)] md:gap-8 md:pt-0 lg:grid-cols-[minmax(0,1fr)_minmax(340px,420px)] lg:gap-16">
          <aside className="order-2 w-full justify-self-center md:order-2 md:justify-self-start">
            <div className="relative mx-auto flex w-full max-w-102 items-center justify-center py-2 md:py-0">
              <div className="absolute size-[min(520px,92vw)] rounded-full border border-white/8 bg-[#07140d]/90 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04),0_42px_120px_-64px_rgba(30,215,96,0.95)]" />
              <div className="absolute inset-s-3 top-16 hidden h-20 w-24 -rotate-12 rounded-3xl border border-[#1ED760]/18 bg-[#1ED760]/14 blur-sm md:block" />
              <div className="absolute bottom-16 inset-e-4 hidden h-24 w-28 rotate-12 rounded-3xl border border-[#1ED760]/12 bg-[#0c2b1b]/80 blur-sm md:block" />
              <div className="relative rotate-0 shadow-[0_32px_100px_-48px_rgba(0,0,0,0.9)] md:rotate-3">
                <PhoneMockupFrame>
                  <PublicProfileCard
                    as="div"
                    profile={profilePreview}
                    interactive
                    formSubmitAction={submitLandingPreviewFormAction}
                    bookingSlotsAction={getLandingPreviewBookingSlotsAction}
                    bookingSubmitAction={submitLandingPreviewBookingAction}
                    className="min-h-full text-foreground md:rounded-none! md:p-5! md:shadow-none! lg:p-6!"
                    headerSlot={
                      <div className="flex items-center justify-between">
                        <span className="tap-target inline-flex size-10 items-center justify-center rounded-full bg-foreground/7 text-foreground">
                          <Image
                            src="/brand/logo.svg"
                            alt=""
                            width={22}
                            height={25}
                            style={{ width: "22px", height: "auto" }}
                          />
                        </span>
                        <span className="tap-target inline-flex size-10 items-center justify-center rounded-full bg-foreground/7 text-foreground">
                          <Share2Icon className="size-4.5" />
                        </span>
                      </div>
                    }
                    footerSlot={
                      <Link
                        href="https://kioar.com?ref=profile"
                        className="inline-flex items-center gap-1.5 rounded-full border border-sidebar-border bg-sidebar px-4 py-2 text-sm font-semibold text-foreground transition-opacity hover:opacity-70"
                      >
                        <Image
                          src="/brand/logo.svg"
                          alt=""
                          width={14}
                          height={16}
                          style={{ width: "14px", height: "auto" }}
                        />
                        <span>ساخته‌شده با کی‌یو‌آر</span>
                      </Link>
                    }
                  />
                </PhoneMockupFrame>
              </div>
            </div>
          </aside>

          <section className="order-1 flex max-w-xl flex-col items-center text-center md:items-start md:text-right md:justify-self-end md:pb-12">
            <div className="inline-flex items-center gap-2 whitespace-nowrap rounded-[28px] border border-white/10 bg-black/16 px-4 py-3 pl-5 shadow-[0_28px_70px_-42px_rgba(0,0,0,0.95)] backdrop-blur-sm">
              <span className="rounded-full border border-white/8 px-3 py-1 text-[10px] font-black text-white/44">
                نسخه پریمیوم
              </span>
              <span className="whitespace-nowrap text-[12px] font-bold text-white/90 ">
                امکانات نامحدود
              </span>
            </div>

            <h1 className="mt-8 max-w-xl text-[46px] font-bold leading-[1.08] text-white sm:mt-10 sm:text-[62px] lg:text-[70px]">
              کی‌یو‌آر، هویت دیجیتالِ تو.
            </h1>
            <p className="mt-9 max-w-120 text-[16px] leading-7 text-white/62 sm:mt-10 sm:text-[18px] sm:leading-8">
              صفحه لینکِ خودت رو بساز، با دنبال‌کننده‌هات به اشتراک بذار و برندت
              رو رشد بده. از امروز حضور آنلاین‌ت رو معنی‌دار کن.
            </p>

            <div className="mt-11 flex w-full flex-col items-center gap-3 sm:mt-12 sm:w-auto sm:flex-row sm:items-center md:items-start">
              <div className="hero-cta-ring w-fit">
                <Link
                  href="/auth"
                  className="relative inline-flex h-15 items-center justify-center gap-2.5 rounded-full bg-[#1ED760] px-9 text-lg font-bold text-[#03140b] transition-colors hover:bg-[#18c653]"
                >
                  ساخت صفحه رایگان
                  <ArrowLeftIcon className="size-5" />
                </Link>
              </div>
            </div>
          </section>
        </div>

        <footer className="mt-10 shrink-0 border-t border-white/10 pt-5 text-white/80 md:mt-0 md:pt-4">
          <div className="flex flex-col items-center gap-5 md:flex-row md:items-start md:justify-between">
            <div className="flex flex-col items-center gap-4 md:items-start md:gap-3">
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 md:justify-start">
                <Link
                  href="/"
                  aria-label="کی‌یو‌آر"
                  className="inline-flex items-center text-white/78 transition-opacity hover:opacity-80"
                >
                  <Image
                    src="/brand/logo-white.svg"
                    alt=""
                    width={22}
                    height={25}
                    style={{ width: "22px", height: "25px" }}
                  />
                </Link>
                <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm font-semibold md:justify-start">
                  {footerLinks.map((item) =>
                    item.href === "#" ? (
                      <a
                        key={item.label}
                        href="#"
                        className="transition-colors hover:text-white"
                      >
                        {item.label}
                      </a>
                    ) : (
                      <Link
                        key={item.label}
                        href={item.href}
                        className="transition-colors hover:text-white"
                      >
                        {item.label}
                      </Link>
                    ),
                  )}
                  <TrustBadgesModal variant="dark" />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-center gap-4 md:justify-start">
              {socialLinks.map(({ label, href, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="inline-flex size-9 items-center justify-center rounded-full text-white/62 transition-colors hover:bg-white/8 hover:text-white"
                  target={href.startsWith("http") ? "_blank" : undefined}
                  rel={href.startsWith("http") ? "noreferrer" : undefined}
                >
                  <Icon className="size-4.5" />
                </a>
              ))}
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
