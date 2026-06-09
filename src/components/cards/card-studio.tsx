"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowRight, Check, CreditCard, Gift, ScanLine } from "lucide-react";

import { Card3D } from "@/components/cards/card-3d";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PROVINCE_NAMES, citiesForProvince } from "@/lib/cards/iran-geo";
import { formatPersianNumber } from "@/lib/persian";

type Material = "colorful" | "metal";
type ColorOption = { value: string; label: string };
type PageOption = {
  id: string;
  slug: string;
  fullName: string | null;
  suggestedName: string;
};
type Entitlement = { id: string; material: Material; source: string };

type StudioSettings = {
  prices: Record<Material, number>;
  colors: Record<Material, ColorOption[]>;
  materialEnabled: Record<Material, boolean>;
  copyCardIncludesPlan: string;
  purchaseGrantsPlan: "free" | "pro" | "business";
  offerCardGrantsPlan: boolean;
  shippingCost: number;
};

const MATERIAL_LABEL: Record<Material, string> = {
  colorful: "بانکی (PVC)",
  metal: "پریمیوم (فلزی)",
};

const PLAN_LABEL_UPPER: Record<string, string> = {
  pro: "PRO",
  business: "BUSINESS",
};

const PLAN_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  pro: { bg: "rgba(30,215,96,0.07)", border: "rgba(30,215,96,0.22)", text: "#1ed760" },
  business: { bg: "rgba(168,85,247,0.07)", border: "rgba(168,85,247,0.22)", text: "#a855f7" },
};

type SavedAddress = {
  province: string;
  city: string;
  address: string;
  postalCode: string;
} | null;

export function CardStudio({
  pages,
  settings,
  entitlements,
  savedAddress,
}: {
  pages: PageOption[];
  settings: StudioSettings;
  entitlements: Entitlement[];
  savedAddress?: SavedAddress;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"configure" | "checkout">("configure");

  const selectedPage = pages[0];
  const pageId = selectedPage?.id ?? "";

  const enabledMaterials = (["colorful", "metal"] as Material[]).filter(
    (m) => settings.materialEnabled[m],
  );
  const [material, setMaterial] = useState<Material>(
    enabledMaterials[0] ?? "colorful",
  );
  const [color, setColor] = useState(
    settings.colors[material]?.[0]?.value ?? "black",
  );
  const [nameOnCard, setNameOnCard] = useState(selectedPage?.suggestedName ?? "");
  // Lifted from Card3D so FaceToggle can control it.
  const [flipped, setFlipped] = useState(false);

  const [province, setProvince] = useState(savedAddress?.province ?? "");
  const [city, setCity] = useState(savedAddress?.city ?? "");
  const [address, setAddress] = useState(savedAddress?.address ?? "");
  const [postalCode, setPostalCode] = useState(savedAddress?.postalCode ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matchingEntitlement = useMemo(
    () => entitlements.find((e) => e.material === material) ?? null,
    [entitlements, material],
  );
  const isFree = Boolean(matchingEntitlement);
  const price = settings.prices[material];
  const cities = useMemo(() => citiesForProvince(province), [province]);

  const entitlementSourcePlan =
    matchingEntitlement?.source === "gift_business"
      ? "business"
      : matchingEntitlement?.source === "gift_pro"
        ? "pro"
        : null;
  const cardGrantsPlanKey = isFree
    ? (entitlementSourcePlan ?? settings.purchaseGrantsPlan)
    : settings.purchaseGrantsPlan;
  const showPlanGift = settings.offerCardGrantsPlan && cardGrantsPlanKey !== "free";
  const planColors = PLAN_COLORS[cardGrantsPlanKey] ?? PLAN_COLORS.pro;

  function onMaterialChange(m: Material) {
    setMaterial(m);
    setColor(settings.colors[m]?.[0]?.value ?? "black");
    setFlipped(false);
  }

  function handleBack() {
    if (step === "checkout") {
      setStep("configure");
    } else {
      router.back();
    }
  }

  async function submit() {
    setError(null);
    if (!pageId) return setError("یک صفحه را انتخاب کنید.");
    if (!nameOnCard.trim()) return setError("نام روی کارت را وارد کنید.");
    if (!province) return setError("استان را انتخاب کنید.");
    if (!city.trim()) return setError("شهر را وارد کنید.");
    if (address.trim().length < 5) return setError("نشانی کامل را وارد کنید.");
    if (!/^\d{10}$/.test(postalCode)) return setError("کد پستی باید ۱۰ رقم باشد.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/cards/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId,
          material,
          color,
          nameOnCard: nameOnCard.trim(),
          province,
          city: city.trim(),
          address: address.trim(),
          postalCode,
          entitlementId: matchingEntitlement?.id,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        redirectUrl?: string;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.redirectUrl) {
        setError(messageForError(data.error));
        setSubmitting(false);
        return;
      }
      window.location.href = data.redirectUrl;
    } catch {
      setError("خطای شبکه. دوباره تلاش کنید.");
      setSubmitting(false);
    }
  }

  if (pages.length === 0) {
    return (
      <div className="flex h-full flex-col bg-[#0a0a0a]">
        {renderTopBar()}
        <div className="flex flex-1 items-center justify-center p-6">
          <p className="max-w-sm rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-neutral-400">
            ابتدا یک صفحه بسازید تا بتوانید برایش کارت سفارش دهید.
          </p>
        </div>
      </div>
    );
  }

  const colorLabel =
    material === "metal"
      ? "مشکی"
      : (settings.colors[material].find((c) => c.value === color)?.label ?? color);
  const totalPrice = isFree ? 0 : price + settings.shippingCost;

  return (
    <div className="flex h-full flex-col bg-[#0a0a0a]">
      {renderTopBar()}

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:grid lg:grid-cols-[400px_1fr] lg:overflow-hidden">

        {/* ───── Right sidebar ───── */}
        <div className="order-2 lg:order-1 lg:flex lg:h-full lg:min-h-0 lg:flex-col lg:border-e lg:border-white/8">
          {/* Scrollable fields area */}
          <div className="flex-1 overflow-y-auto">
            <div className="-mt-4 rounded-t-[1.75rem] bg-[#0a0a0a] p-5 pb-4 shadow-[0_-16px_40px_-8px_rgba(0,0,0,0.8)] lg:mt-0 lg:rounded-none lg:p-7 lg:shadow-none">
              {/* Mobile drag handle */}
              <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/10 lg:hidden" />

              {step === "configure" ? (
                <div className="space-y-7">

                  {/* 1. Material — no label, full-pill */}
                  <div className="grid grid-cols-2 gap-2 rounded-full bg-white/[0.06] p-1">
                    {enabledMaterials.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => onMaterialChange(m)}
                        aria-pressed={material === m}
                        className={`h-11 rounded-full px-3 text-sm font-semibold transition-all ${
                          material === m
                            ? "bg-white text-neutral-950 shadow-md"
                            : "text-neutral-400 hover:text-white"
                        }`}
                      >
                        {MATERIAL_LABEL[m]}
                      </button>
                    ))}
                  </div>

                  {/* 2. Face toggle — no label, dashed card style */}
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setFlipped(false)}
                      aria-pressed={!flipped}
                      className={`flex flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed px-3 py-5 text-sm font-semibold transition-all ${
                        !flipped
                          ? "border-white bg-white/[0.05] text-white"
                          : "border-white/12 text-neutral-500 hover:border-white/22 hover:text-neutral-300"
                      }`}
                    >
                      <CreditCard className="size-5" />
                      روی کارت
                    </button>
                    <button
                      type="button"
                      onClick={() => setFlipped(true)}
                      aria-pressed={flipped}
                      className={`flex flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed px-3 py-5 text-sm font-semibold transition-all ${
                        flipped
                          ? "border-white bg-white/[0.05] text-white"
                          : "border-white/12 text-neutral-500 hover:border-white/22 hover:text-neutral-300"
                      }`}
                    >
                      <ScanLine className="size-5" />
                      پشت کارت
                    </button>
                  </div>

                  {/* 3. Name on card */}
                  <div className="space-y-3.5 mb-4">
                    <Label htmlFor="name-on-card" className="text-sm font-semibold text-white">
                      نام روی کارت (لاتین)
                    </Label>
                    <Input
                      id="name-on-card"
                      value={nameOnCard}
                      onChange={(e) => setNameOnCard(e.target.value)}
                      dir="ltr"
                      maxLength={40}
                      autoCapitalize="words"
                      autoCorrect="off"
                      spellCheck={false}
                      enterKeyHint="done"
                      placeholder="Your Name"
                      className="h-14 rounded-xl border-white/8 bg-[#0a0a0a] px-5 py-6 text-[1.125rem] text-neutral-100 placeholder:text-neutral-600 focus-visible:border-[#1ed760]/40 focus-visible:ring-0"
                    />
                  </div>

                  {/* 4. Color swatches — only for colorful */}
                  {material === "colorful" ? (
                    <div className="space-y-4">
                      <span className="text-sm font-semibold text-white">رنگ کارت</span>
                      <div className="no-scrollbar flex items-center gap-3.5 overflow-x-auto px-1.5 py-3">
                        {settings.colors[material].map((c) => {
                          const active = color === c.value;
                          return (
                            <button
                              key={c.value}
                              type="button"
                              onClick={() => setColor(c.value)}
                              aria-label={c.label}
                              aria-pressed={active}
                              title={c.label}
                              className={`relative shrink-0 grid size-10 place-items-center rounded-full ring-2 transition-all ${
                                active
                                  ? "ring-white scale-110"
                                  : "ring-white/15 hover:ring-white/40 hover:scale-105"
                              }`}
                            >
                              <span
                                className="size-8 rounded-full ring-1 ring-inset ring-black/15"
                                style={{ backgroundColor: swatchHex(c.value) }}
                              />
                              {active ? (
                                <Check
                                  strokeWidth={3}
                                  className="absolute size-4"
                                  style={{ color: "#000" }}
                                />
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                /* Checkout fields */
                <div className="space-y-6">
                  <h2 className="text-base font-bold text-white">نشانی ارسال</h2>

                  <Field label="استان">
                    <Select
                      value={province}
                      onValueChange={(v) => { setProvince(v ?? ""); setCity(""); }}
                    >
                      <SelectTrigger className="h-11 w-full rounded-xl border-white/8 bg-[#0a0a0a] text-neutral-100">
                        <SelectValue placeholder="انتخاب استان" />
                      </SelectTrigger>
                      <SelectContent>
                        {PROVINCE_NAMES.map((p) => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="شهر" htmlFor="city">
                    {cities.length > 0 ? (
                      <Select value={city} onValueChange={(v) => setCity(v ?? "")}>
                        <SelectTrigger className="h-11 w-full rounded-xl border-white/8 bg-[#0a0a0a] text-neutral-100">
                          <SelectValue placeholder="انتخاب شهر" />
                        </SelectTrigger>
                        <SelectContent>
                          {cities.map((c) => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id="city"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="نام شهر"
                        enterKeyHint="next"
                        className="h-11 w-full rounded-xl border-white/8 bg-[#0a0a0a] text-neutral-100 placeholder:text-neutral-600"
                      />
                    )}
                  </Field>

                  <Field label="نشانی کامل" htmlFor="address">
                    <Input
                      id="address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      enterKeyHint="next"
                      autoComplete="street-address"
                      placeholder="مثلاً شهید بهشتی، خیابان صابونچی پلاک ۱۴ طبقه ۳"
                      className="h-11 w-full rounded-xl border-white/8 bg-[#0a0a0a] text-neutral-100 placeholder:text-neutral-600"
                    />
                  </Field>

                  <Field label="کد پستی" htmlFor="postal">
                    <Input
                      id="postal"
                      value={postalCode}
                      onChange={(e) =>
                        setPostalCode(e.target.value.replace(/\D/g, "").slice(0, 10))
                      }
                      dir="ltr"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="postal-code"
                      enterKeyHint="done"
                      maxLength={10}
                      className="h-11 w-full rounded-xl border-white/8 bg-[#0a0a0a] text-neutral-100"
                    />
                  </Field>

                  {/* Checkout summary */}
                  <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4 text-sm space-y-2.5">
                    {/* Card line */}
                    <div className="flex items-center justify-between text-neutral-300">
                      <span>{MATERIAL_LABEL[material]}</span>
                      {isFree ? (
                        <span className="font-medium text-[#1ed760]">رایگان</span>
                      ) : (
                        <span className="font-medium text-white" dir="ltr">
                          {formatPersianNumber(price)} تومان
                        </span>
                      )}
                    </div>

                    {/* Plan gift — shown as a line item right after the card */}
                    {showPlanGift ? (
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5" style={{ color: planColors.text }}>
                          <Gift className="size-3 shrink-0" />
                          ۱ سال پلن {PLAN_LABEL_UPPER[cardGrantsPlanKey]}
                        </span>
                        <span style={{ color: planColors.text }}>رایگان</span>
                      </div>
                    ) : null}

                    {/* Shipping */}
                    <div className="flex items-center justify-between text-xs text-neutral-500">
                      <span>هزینه ارسال</span>
                      {settings.shippingCost === 0 ? (
                        <span className="text-[#1ed760]">رایگان</span>
                      ) : (
                        <span className="text-neutral-300" dir="ltr">
                          {formatPersianNumber(settings.shippingCost)} تومان
                        </span>
                      )}
                    </div>

                    {/* Total */}
                    <div className="border-t border-white/8 pt-2.5 flex items-center justify-between font-semibold text-white">
                      <span>جمع کل</span>
                      {isFree ? (
                        <span className="text-[#1ed760]">رایگان</span>
                      ) : (
                        <span dir="ltr">{formatPersianNumber(totalPrice)} تومان</span>
                      )}
                    </div>
                  </div>

                  {error ? (
                    <p className="rounded-lg bg-red-500/10 px-3 py-2.5 text-sm text-red-400">
                      {error}
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          {/* ── Sticky bottom: gift banner + price row + CTA ── */}
          <div className="shrink-0 bg-[#0a0a0a] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 lg:px-7">
            {step === "configure" ? (
              <div className="space-y-3">
                {showPlanGift ? (
                  <div
                    className="flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs"
                    style={{ borderColor: planColors.border }}
                  >
                    <Gift className="size-3.5 shrink-0" style={{ color: planColors.text }} />
                    <span className="text-neutral-300">
                      این کارت شامل{" "}
                      <span className="font-bold" style={{ color: planColors.text }}>
                        یک سال اشتراک  {PLAN_LABEL_UPPER[cardGrantsPlanKey]}
                      </span>{" "}
                      رایگان است
                    </span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-4 py-2.5">
                  <span className="text-xs text-neutral-500">قیمت کارت</span>
                  {isFree ? (
                    <span className="text-sm font-semibold text-[#1ed760]">رایگان</span>
                  ) : (
                    <span className="text-sm font-semibold text-neutral-200" dir="ltr">
                      {formatPersianNumber(price)} تومان
                    </span>
                  )}
                </div>
                <Button
                  type="button"
                  onClick={() => setStep("checkout")}
                  className="h-12 w-full rounded-full bg-[#1ed760] text-base font-semibold text-black hover:bg-[#17c254] active:bg-[#14b04a] transition-colors"
                >
                  ثبت سفارش
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="h-12 w-full rounded-full bg-[#1ed760] text-base font-semibold text-black hover:bg-[#17c254] active:bg-[#14b04a] transition-colors disabled:opacity-50"
              >
                {submitting ? "در حال انتقال…" : isFree ? "ثبت سفارش رایگان" : "پرداخت"}
              </Button>
            )}
          </div>
        </div>

        {/* ───── Left stage: card preview ───── */}
        <div className="order-1 lg:order-2 relative flex shrink-0 items-center justify-center overflow-hidden px-6 pb-6 pt-8 lg:h-full lg:pb-0 lg:pt-0">
          {/* Dot grid */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage:
                "radial-gradient(rgba(255,255,255,0.2) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
          />
          <div className="relative flex w-full max-w-[72%] flex-col items-center gap-4">
            <div className="card-float w-full">
              <Card3D
                material={material}
                color={color}
                name={nameOnCard || selectedPage?.fullName || ""}
                slug={selectedPage?.slug ?? ""}
                flipped={flipped}
                onFlipChange={setFlipped}
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );

  function renderTopBar() {
    return (
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/8 bg-[#0a0a0a] px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
        <button
          type="button"
          onClick={handleBack}
          aria-label="بازگشت"
          className="tap-target -ms-2 grid size-10 place-items-center rounded-full text-neutral-400 transition-colors hover:bg-white/5 hover:text-white"
        >
          <ArrowRight className="size-5" />
        </button>
        <h1 className="text-sm font-bold text-white sm:text-base">کارت‌های کی‌یوآر</h1>
        <span className="size-10" />
      </header>
    );
  }
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-sm font-semibold text-white">
        {label}
      </Label>
      {children}
    </div>
  );
}

function messageForError(code?: string): string {
  switch (code) {
    case "forbidden":
      return "این صفحه متعلق به شما نیست.";
    case "material_unavailable":
      return "این جنس کارت در دسترس نیست.";
    case "invalid_color":
      return "رنگ انتخابی نامعتبر است.";
    case "invalid_province":
      return "استان نامعتبر است.";
    case "gateway_unavailable":
      return "درگاه پرداخت در دسترس نیست. بعداً تلاش کنید.";
    case "entitlement_unavailable":
      return "این هدیه قابل استفاده نیست.";
    default:
      return "ثبت سفارش ناموفق بود. دوباره تلاش کنید.";
  }
}

function swatchHex(value: string): string {
  const map: Record<string, string> = {
    orange: "#FE774A",
    lime: "#F0FE00",
    cyan: "#03BFFF",
    pink: "#FE4CBB",
    black: "#111111",
    silver: "#c0c0c0",
    gold: "#d4af37",
  };
  return map[value] ?? value;
}

function isDarkSwatch(value: string): boolean {
  return value !== "lime";
}
