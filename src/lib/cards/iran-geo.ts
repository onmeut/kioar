/**
 * Iran provinces → major cities, for the card-shipping address picker.
 *
 * Scope: all 31 provinces, with each province's most populous / commonly
 * shipped-to cities. This is NOT the exhaustive official county/city list
 * (which runs to hundreds of entries) — the checkout exposes a free-text
 * city fallback for anything not listed, so coverage gaps don't block an
 * order. Province coverage IS complete.
 *
 * Stored as a static module (no DB table) — it's reference data that never
 * changes at runtime and is needed both server-side (validation) and
 * client-side (the cascading Select).
 */

export type IranProvince = {
  /** Stable Persian province name (used as the stored value). */
  name: string;
  cities: string[];
};

export const IRAN_PROVINCES: IranProvince[] = [
  {
    name: "آذربایجان شرقی",
    cities: ["تبریز", "مراغه", "مرند", "اهر", "میانه", "بناب", "سراب", "شبستر"],
  },
  {
    name: "آذربایجان غربی",
    cities: ["ارومیه", "خوی", "میاندوآب", "بوکان", "مهاباد", "سلماس", "نقده", "پیرانشهر"],
  },
  {
    name: "اردبیل",
    cities: ["اردبیل", "پارس‌آباد", "مشگین‌شهر", "خلخال", "گرمی", "بیله‌سوار"],
  },
  {
    name: "اصفهان",
    cities: ["اصفهان", "کاشان", "خمینی‌شهر", "نجف‌آباد", "شاهین‌شهر", "فولادشهر", "گلپایگان", "شهرضا", "آران و بیدگل"],
  },
  {
    name: "البرز",
    cities: ["کرج", "فردیس", "نظرآباد", "هشتگرد", "ماهدشت", "محمدشهر", "اشتهارد"],
  },
  {
    name: "ایلام",
    cities: ["ایلام", "دهلران", "آبدانان", "ایوان", "مهران", "دره‌شهر"],
  },
  {
    name: "بوشهر",
    cities: ["بوشهر", "برازجان", "گناوه", "دیلم", "کنگان", "خورموج", "عسلویه"],
  },
  {
    name: "تهران",
    cities: ["تهران", "اسلام‌شهر", "شهریار", "قدس", "ملارد", "ورامین", "پاکدشت", "ری", "پردیس", "دماوند", "رباط‌کریم"],
  },
  {
    name: "چهارمحال و بختیاری",
    cities: ["شهرکرد", "بروجن", "فارسان", "لردگان", "سامان", "اردل"],
  },
  {
    name: "خراسان جنوبی",
    cities: ["بیرجند", "قائن", "فردوس", "طبس", "نهبندان", "سرایان"],
  },
  {
    name: "خراسان رضوی",
    cities: ["مشهد", "نیشابور", "سبزوار", "تربت‌حیدریه", "قوچان", "کاشمر", "تربت‌جام", "گناباد", "چناران"],
  },
  {
    name: "خراسان شمالی",
    cities: ["بجنورد", "شیروان", "اسفراین", "آشخانه", "جاجرم", "فاروج"],
  },
  {
    name: "خوزستان",
    cities: ["اهواز", "آبادان", "خرمشهر", "دزفول", "اندیمشک", "بهبهان", "ماهشهر", "شوشتر", "ایذه", "شوش"],
  },
  {
    name: "زنجان",
    cities: ["زنجان", "ابهر", "خرمدره", "قیدار", "ماه‌نشان"],
  },
  {
    name: "سمنان",
    cities: ["سمنان", "شاهرود", "دامغان", "گرمسار", "مهدی‌شهر"],
  },
  {
    name: "سیستان و بلوچستان",
    cities: ["زاهدان", "زابل", "ایرانشهر", "چابهار", "سراوان", "خاش", "نیک‌شهر"],
  },
  {
    name: "فارس",
    cities: ["شیراز", "مرودشت", "جهرم", "فسا", "کازرون", "داراب", "لار", "فیروزآباد", "آباده", "نی‌ریز"],
  },
  {
    name: "قزوین",
    cities: ["قزوین", "البرز", "تاکستان", "آبیک", "بوئین‌زهرا", "محمدیه"],
  },
  {
    name: "قم",
    cities: ["قم", "جعفریه", "کهک", "قنوات"],
  },
  {
    name: "کردستان",
    cities: ["سنندج", "سقز", "مریوان", "بانه", "قروه", "بیجار", "کامیاران"],
  },
  {
    name: "کرمان",
    cities: ["کرمان", "سیرجان", "رفسنجان", "جیرفت", "بم", "زرند", "بردسیر", "کهنوج"],
  },
  {
    name: "کرمانشاه",
    cities: ["کرمانشاه", "اسلام‌آباد غرب", "هرسین", "کنگاور", "سنقر", "صحنه", "پاوه"],
  },
  {
    name: "کهگیلویه و بویراحمد",
    cities: ["یاسوج", "دوگنبدان", "دهدشت", "سی‌سخت", "لیکک"],
  },
  {
    name: "گلستان",
    cities: ["گرگان", "گنبد کاووس", "علی‌آباد کتول", "آق‌قلا", "کردکوی", "بندر ترکمن", "مینودشت", "آزادشهر"],
  },
  {
    name: "گیلان",
    cities: ["رشت", "بندر انزلی", "لاهیجان", "لنگرود", "آستارا", "رودسر", "صومعه‌سرا", "تالش", "فومن"],
  },
  {
    name: "لرستان",
    cities: ["خرم‌آباد", "بروجرد", "دورود", "الیگودرز", "کوهدشت", "ازنا", "نورآباد"],
  },
  {
    name: "مازندران",
    cities: ["ساری", "بابل", "آمل", "قائم‌شهر", "بهشهر", "چالوس", "تنکابن", "نوشهر", "بابلسر", "محمودآباد", "نکا"],
  },
  {
    name: "مرکزی",
    cities: ["اراک", "ساوه", "خمین", "محلات", "دلیجان", "شازند", "تفرش"],
  },
  {
    name: "هرمزگان",
    cities: ["بندرعباس", "میناب", "بندر لنگه", "قشم", "کیش", "رودان", "حاجی‌آباد"],
  },
  {
    name: "همدان",
    cities: ["همدان", "ملایر", "نهاوند", "اسدآباد", "تویسرکان", "بهار", "کبودرآهنگ"],
  },
  {
    name: "یزد",
    cities: ["یزد", "میبد", "اردکان", "بافق", "مهریز", "ابرکوه", "تفت"],
  },
];

export const PROVINCE_NAMES: string[] = IRAN_PROVINCES.map((p) => p.name);

const PROVINCE_MAP = new Map(IRAN_PROVINCES.map((p) => [p.name, p]));

export function isValidProvince(name: string): boolean {
  return PROVINCE_MAP.has(name);
}

export function citiesForProvince(province: string): string[] {
  return PROVINCE_MAP.get(province)?.cities ?? [];
}
