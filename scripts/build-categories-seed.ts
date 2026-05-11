/**
 * One-shot generator that produces the canonical seed data + migration SQL
 * for the new two-level taxonomy (industries → categories).
 *
 * Inputs:
 *   - ./Kioar_Categories_Final_2026.json  (parsed export of the XLSX file)
 *
 * Outputs:
 *   - scripts/data/categories-seed.json
 *   - drizzle/0046_industries_categories.sql
 *
 * Run:   npx tsx scripts/build-categories-seed.ts
 *
 * The translation + icon maps in this file are the source of truth for FA
 * names. If you need to retranslate a category, edit this file and re-run.
 */

import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AccountType = "personal" | "business";

interface IndustrySeed {
  slug: string;
  titleFa: string;
  titleEn: string;
  iconKey: string;
  accountTypes: AccountType[];
  sortOrder: number;
  isActive: boolean;
}

interface CategorySeed {
  industrySlug: string;
  slug: string;
  titleFa: string;
  titleEn: string;
  iconKey: string;
  accountType: AccountType;
  sortOrder: number;
  isActive: boolean;
}

interface SeedFile {
  industries: IndustrySeed[];
  categories: CategorySeed[];
  /** Map of legacy discover_categories.slug → new categories.slug (or null). */
  legacyMap: Record<string, string | null>;
}

// ---------------------------------------------------------------------------
// Industry FA translations + icon assignments + admin sort order tiebreak
// ---------------------------------------------------------------------------

const INDUSTRY_META: Record<
  string,
  { slug: string; titleFa: string; iconKey: string }
> = {
  "Arts & Entertainment": {
    slug: "arts-entertainment",
    titleFa: "هنر و سرگرمی",
    iconKey: "t:palette",
  },
  Creator: { slug: "creator", titleFa: "سازندگان محتوا", iconKey: "t:video" },
  Lifestyle: { slug: "lifestyle", titleFa: "سبک زندگی", iconKey: "t:heart" },
  "Sports & Fitness": {
    slug: "sports-fitness",
    titleFa: "ورزش و تناسب اندام",
    iconKey: "t:basketball",
  },
  "Food & Beverage": {
    slug: "food-beverage",
    titleFa: "غذا و نوشیدنی",
    iconKey: "t:chef-hat",
  },
  Fashion: { slug: "fashion", titleFa: "مد و پوشاک", iconKey: "t:shirt" },
  "Gaming & Tech": {
    slug: "gaming-tech",
    titleFa: "بازی و فناوری",
    iconKey: "t:dice",
  },
  "Design & Creative": {
    slug: "design-creative",
    titleFa: "طراحی و خلاقیت",
    iconKey: "t:palette",
  },
  "Health & Wellness": {
    slug: "health-wellness",
    titleFa: "سلامت و تندرستی",
    iconKey: "t:yoga",
  },
  Beauty: { slug: "beauty", titleFa: "زیبایی", iconKey: "t:sparkles" },
  "Health & Medical": {
    slug: "health-medical",
    titleFa: "پزشکی و سلامت",
    iconKey: "t:stethoscope",
  },
  "Business & Professional": {
    slug: "business-professional",
    titleFa: "کسب‌وکار و حرفه‌ای",
    iconKey: "t:briefcase",
  },
  "Professional Services": {
    slug: "professional-services",
    titleFa: "خدمات تخصصی",
    iconKey: "t:briefcase",
  },
  Finance: { slug: "finance", titleFa: "امور مالی", iconKey: "t:coin" },
  Education: { slug: "education", titleFa: "آموزش", iconKey: "t:book" },
  Retail: { slug: "retail", titleFa: "فروشگاه", iconKey: "t:shopping-bag" },
  "Agencies & Marketing": {
    slug: "agencies-marketing",
    titleFa: "آژانس و بازاریابی",
    iconKey: "t:speakerphone",
  },
  "Real Estate": {
    slug: "real-estate",
    titleFa: "املاک",
    iconKey: "t:building",
  },
  Technology: {
    slug: "technology",
    titleFa: "فناوری اطلاعات",
    iconKey: "t:code",
  },
  Automotive: { slug: "automotive", titleFa: "خودرو", iconKey: "t:car" },
  "Home Services": {
    slug: "home-services",
    titleFa: "خدمات منزل",
    iconKey: "t:home",
  },
  Entertainment: {
    slug: "entertainment",
    titleFa: "سرگرمی",
    iconKey: "t:confetti",
  },
  Events: { slug: "events", titleFa: "رویدادها", iconKey: "t:confetti" },
  "Travel & Tourism": {
    slug: "travel-tourism",
    titleFa: "سفر و گردشگری",
    iconKey: "t:plane",
  },
  Media: { slug: "media", titleFa: "رسانه", iconKey: "t:news" },
  "Community & Nonprofit": {
    slug: "community-nonprofit",
    titleFa: "خیریه و انجمن",
    iconKey: "t:heart",
  },
  Agriculture: { slug: "agriculture", titleFa: "کشاورزی", iconKey: "t:plant" },
};

// Strip a "… / <Persian text>" trailing suffix (Iran rows) while preserving
// English canonical names that contain " / " (e.g. "Travel Company / Agency").
function stripFaSuffix(raw: string): string {
  const parts = raw.split("/");
  if (parts.length < 2) return raw.trim();
  const last = parts[parts.length - 1]!.trim();
  // If the part after the last `/` contains Persian characters, drop it.
  if (/[؀-ۿ]/.test(last)) {
    return parts.slice(0, -1).join("/").trim();
  }
  return raw.trim();
}

/**
 * Normalize XLSX "Industry Group" cell into a canonical English key.
 */
function normalizeIndustry(raw: string): string {
  const en = stripFaSuffix(raw);
  if (!INDUSTRY_META[en]) {
    throw new Error(`Unknown industry: "${raw}" (normalized: "${en}")`);
  }
  return en;
}

// ---------------------------------------------------------------------------
// Category FA translations + icon assignments
// Keyed by canonical English name (the part before " / " in Iran rows).
// ---------------------------------------------------------------------------

const CATEGORY_FA: Record<string, { titleFa: string; iconKey: string }> = {
  // ── Arts & Entertainment (Individual) ──────────────────────────────────
  Actor: { titleFa: "بازیگر", iconKey: "t:user" },
  Artist: { titleFa: "هنرمند", iconKey: "t:palette" },
  Comedian: { titleFa: "کمدین", iconKey: "t:smile" },
  "Musician / Band": { titleFa: "نوازنده / گروه موسیقی", iconKey: "t:music" },
  Musician: { titleFa: "نوازنده", iconKey: "t:music" },
  Band: { titleFa: "گروه موسیقی", iconKey: "t:music" },
  Painter: { titleFa: "نقاش", iconKey: "t:palette" },
  Writer: { titleFa: "نویسنده", iconKey: "t:notebook" },
  Dancer: { titleFa: "رقصنده", iconKey: "t:user" },
  Magician: { titleFa: "شعبده‌باز", iconKey: "t:sparkles" },

  // ── Creator (Individual) ──────────────────────────────────────────────
  Blogger: { titleFa: "بلاگر", iconKey: "t:pencil" },
  "Digital Creator": { titleFa: "سازنده محتوای دیجیتال", iconKey: "t:video" },
  Photographer: { titleFa: "عکاس", iconKey: "t:camera" },
  "Video Creator": { titleFa: "سازنده ویدیو", iconKey: "t:video" },
  Vlogger: { titleFa: "ولاگر", iconKey: "t:camera" },
  Podcaster: { titleFa: "پادکستر", iconKey: "t:microphone" },
  Entrepreneur: { titleFa: "کارآفرین", iconKey: "t:rocket" },
  "Personal Blog": { titleFa: "وبلاگ شخصی", iconKey: "t:pencil" },
  "Public Figure": { titleFa: "چهره عمومی", iconKey: "t:user" },
  "Author / Writer": { titleFa: "نویسنده کتاب", iconKey: "t:book" },

  // ── Lifestyle (Individual) ────────────────────────────────────────────
  "Life Coach": { titleFa: "کوچ زندگی", iconKey: "t:target" },
  "Travel Blogger": { titleFa: "بلاگر سفر", iconKey: "t:plane" },
  "Astrologist & Psychic": { titleFa: "فال‌گیر و طالع‌بین", iconKey: "t:moon" },

  // ── Sports & Fitness (Individual/Business) ────────────────────────────
  Athlete: { titleFa: "ورزشکار", iconKey: "t:trophy" },
  "Personal Trainer": { titleFa: "مربی شخصی", iconKey: "t:basketball" },
  "Sports Coach": { titleFa: "مربی ورزشی", iconKey: "t:flag" },
  "Fitness Trainer": { titleFa: "مربی بدنسازی", iconKey: "t:basketball" },
  "Gym / Physical Fitness Center": {
    titleFa: "باشگاه ورزشی",
    iconKey: "t:basketball",
  },
  "Yoga Studio": { titleFa: "استودیو یوگا", iconKey: "t:yoga" },
  "Boat / Sailing Instructor": {
    titleFa: "مربی قایقرانی",
    iconKey: "t:sailboat",
  },
  "Sports League": { titleFa: "لیگ ورزشی", iconKey: "t:trophy" },

  // ── Food & Beverage ───────────────────────────────────────────────────
  Chef: { titleFa: "سرآشپز", iconKey: "t:chef-hat" },
  Bakery: { titleFa: "نانوایی و شیرینی‌پزی", iconKey: "t:cake" },
  "Coffee Shop": { titleFa: "کافی‌شاپ", iconKey: "t:coffee" },
  Restaurant: { titleFa: "رستوران", iconKey: "t:soup" },
  Cafe: { titleFa: "کافه", iconKey: "t:coffee" },
  "Barbecue Restaurant": { titleFa: "رستوران کبابی", iconKey: "t:meat" },
  "Chicken Joint": { titleFa: "مرغ‌سرا", iconKey: "t:meat" },
  "Chocolate Shop": { titleFa: "شکلات‌فروشی", iconKey: "t:candy" },
  "Dessert Shop": { titleFa: "دسرفروشی", iconKey: "t:cake" },
  "Fast Food Restaurant": { titleFa: "فست‌فود", iconKey: "t:burger" },
  "Food & Beverage": { titleFa: "غذا و نوشیدنی", iconKey: "t:soup" },
  "Ice Cream Shop": { titleFa: "بستنی‌فروشی", iconKey: "t:ice-cream" },
  "Indian Restaurant": { titleFa: "رستوران هندی", iconKey: "t:soup" },
  "Japanese Restaurant": { titleFa: "رستوران ژاپنی", iconKey: "t:soup" },
  "Mediterranean Restaurant": {
    titleFa: "رستوران مدیترانه‌ای",
    iconKey: "t:soup",
  },
  "Pizza Place": { titleFa: "پیتزافروشی", iconKey: "t:pizza" },
  "African Restaurant": { titleFa: "رستوران آفریقایی", iconKey: "t:soup" },
  "Argentinian Restaurant": { titleFa: "رستوران آرژانتینی", iconKey: "t:soup" },
  "Asian Fusion Restaurant": {
    titleFa: "رستوران آسیایی فیوژن",
    iconKey: "t:soup",
  },
  "Australian Restaurant": { titleFa: "رستوران استرالیایی", iconKey: "t:soup" },
  "Buffet Restaurant": { titleFa: "رستوران بوفه", iconKey: "t:soup" },
  "Burger Restaurant": { titleFa: "همبرگرفروشی", iconKey: "t:burger" },
  "Caribbean Restaurant": { titleFa: "رستوران کارائیب", iconKey: "t:soup" },
  "Chinese Restaurant": { titleFa: "رستوران چینی", iconKey: "t:soup" },
  "Comfort Food Restaurant": {
    titleFa: "رستوران غذای خانگی",
    iconKey: "t:soup",
  },
  "Donut Shop": { titleFa: "دونات‌فروشی", iconKey: "t:cookie" },
  "Ethiopian Restaurant": { titleFa: "رستوران اتیوپیایی", iconKey: "t:soup" },
  "European Restaurant": { titleFa: "رستوران اروپایی", iconKey: "t:soup" },
  "Filipino Restaurant": { titleFa: "رستوران فیلیپینی", iconKey: "t:soup" },
  "French Restaurant": { titleFa: "رستوران فرانسوی", iconKey: "t:soup" },
  "Gluten-Free Restaurant": {
    titleFa: "رستوران بدون گلوتن",
    iconKey: "t:salad",
  },
  "Greek Restaurant": { titleFa: "رستوران یونانی", iconKey: "t:soup" },
  "Korean Restaurant": { titleFa: "رستوران کره‌ای", iconKey: "t:soup" },
  "Latin American Restaurant": {
    titleFa: "رستوران آمریکای لاتین",
    iconKey: "t:soup",
  },
  "Mexican Restaurant": { titleFa: "رستوران مکزیکی", iconKey: "t:soup" },
  "Middle Eastern Restaurant": {
    titleFa: "رستوران خاورمیانه‌ای",
    iconKey: "t:soup",
  },
  "Seafood Restaurant": { titleFa: "رستوران غذای دریایی", iconKey: "t:fish" },
  Steakhouse: { titleFa: "استیک‌هاوس", iconKey: "t:meat" },
  "Sushi Restaurant": { titleFa: "رستوران سوشی", iconKey: "t:fish" },
  "Thai Restaurant": { titleFa: "رستوران تایلندی", iconKey: "t:soup" },
  "Turkish Restaurant": { titleFa: "رستوران ترکی", iconKey: "t:soup" },
  "Vegetarian/Vegan Restaurant": {
    titleFa: "رستوران گیاهی",
    iconKey: "t:salad",
  },
  "Vietnamese Restaurant": { titleFa: "رستوران ویتنامی", iconKey: "t:soup" },
  // Iran-specific (combined cell on All Categories sheet; canonicalized to EN)
  Confectionery: { titleFa: "شیرینی‌فروشی", iconKey: "t:cake" },
  "Homemade Food": { titleFa: "غذای خانگی", iconKey: "t:chef-hat" },

  // ── Fashion ───────────────────────────────────────────────────────────
  "Fashion Designer": { titleFa: "طراح مد", iconKey: "t:shirt" },
  "Clothing (Brand)": { titleFa: "برند پوشاک", iconKey: "t:shirt" },
  "Apparel Distributor": { titleFa: "پخش پوشاک", iconKey: "t:package" },
  "Clothing Store": { titleFa: "فروشگاه پوشاک", iconKey: "t:shirt" },
  "Women's Clothing Store": { titleFa: "پوشاک زنانه", iconKey: "t:shirt" },
  Tailor: { titleFa: "خیاطی", iconKey: "t:scissors" },

  // ── Gaming & Tech (Individual) ────────────────────────────────────────
  Gamer: { titleFa: "گیمر", iconKey: "t:dice" },

  // ── Design & Creative ─────────────────────────────────────────────────
  "Graphic Designer": { titleFa: "طراح گرافیک", iconKey: "t:palette" },
  "Event Videographer": { titleFa: "فیلم‌بردار رویداد", iconKey: "t:video" },
  "Architect / Architectural Designer": {
    titleFa: "معمار",
    iconKey: "t:building",
  },

  // ── Health & Wellness (Individual) ────────────────────────────────────
  Nutritionist: { titleFa: "متخصص تغذیه", iconKey: "t:salad" },
  "Aromatherapy Service": { titleFa: "آروماتراپی", iconKey: "t:flower" },
  Therapist: { titleFa: "روان‌درمانگر", iconKey: "t:heart" },
  "Massage Therapist": { titleFa: "ماساژدرمانگر", iconKey: "t:yoga" },
  "Health & Wellness Coach": { titleFa: "کوچ سلامتی", iconKey: "t:target" },
  Acupuncturist: { titleFa: "طب سوزنی", iconKey: "t:dna" },
  "Alternative & Holistic Health": { titleFa: "طب مکمل", iconKey: "t:yoga" },

  // ── Beauty ────────────────────────────────────────────────────────────
  "Makeup Artist": { titleFa: "آرایشگر", iconKey: "t:sparkles" },
  "Beauty Salon": { titleFa: "سالن زیبایی", iconKey: "t:sparkles" },
  "Hair Salon": { titleFa: "آرایشگاه", iconKey: "t:scissors" },
  "Nail Salon": { titleFa: "ناخن‌کاری", iconKey: "t:sparkles" },
  "Barber Shop": { titleFa: "سلمانی", iconKey: "t:scissors" },
  Spa: { titleFa: "اسپا", iconKey: "t:yoga" },
  "Tattoo & Piercing Shop": { titleFa: "تتو و پیرسینگ", iconKey: "t:sparkles" },
  "Photo Studio": { titleFa: "آتلیه عکاسی", iconKey: "t:camera" },

  // ── Health & Medical ──────────────────────────────────────────────────
  Doctor: { titleFa: "پزشک", iconKey: "t:stethoscope" },
  Dentist: { titleFa: "دندان‌پزشک", iconKey: "t:stethoscope" },
  "Cosmetic Dentist": {
    titleFa: "دندان‌پزشک زیبایی",
    iconKey: "t:stethoscope",
  },
  "Family Doctor": { titleFa: "پزشک خانواده", iconKey: "t:stethoscope" },
  Audiologist: { titleFa: "شنوایی‌سنج", iconKey: "t:stethoscope" },
  Chiropractor: { titleFa: "کایروپراکتیک", iconKey: "t:stethoscope" },
  Optometrist: { titleFa: "بینایی‌سنج", iconKey: "t:eye" },
  "Physical Therapist": { titleFa: "فیزیوتراپ", iconKey: "t:stethoscope" },
  "Occupational Therapist": { titleFa: "کاردرمانگر", iconKey: "t:stethoscope" },
  "Medical Center": { titleFa: "مرکز درمانی", iconKey: "t:stethoscope" },
  Veterinarian: { titleFa: "دامپزشک", iconKey: "t:dog" },
  Hospital: { titleFa: "بیمارستان", iconKey: "t:stethoscope" },
  "Pharmacy / Drugstore": { titleFa: "داروخانه", iconKey: "t:flask" },
  Allergist: { titleFa: "متخصص آلرژی", iconKey: "t:stethoscope" },
  "Family Medicine Practice": {
    titleFa: "مطب پزشک خانواده",
    iconKey: "t:stethoscope",
  },

  // ── Business & Professional ───────────────────────────────────────────
  Consultant: { titleFa: "مشاور", iconKey: "t:briefcase" },
  "Consulting Agency": { titleFa: "آژانس مشاوره", iconKey: "t:briefcase" },
  "Business Service": { titleFa: "خدمات کسب‌وکار", iconKey: "t:briefcase" },
  Recruiter: { titleFa: "کارگزین", iconKey: "t:users" },
  "Coworking Space": { titleFa: "فضای کار اشتراکی", iconKey: "t:building" },
  "Office Space": { titleFa: "فضای اداری", iconKey: "t:building" },
  "Business Center": { titleFa: "مرکز تجاری", iconKey: "t:building" },
  "Industrial Company": { titleFa: "شرکت صنعتی", iconKey: "t:building" },
  "Local Business": { titleFa: "کسب‌وکار محلی", iconKey: "t:briefcase" },

  // ── Professional Services ─────────────────────────────────────────────
  Lawyer: { titleFa: "وکیل", iconKey: "t:briefcase" },
  "Environmental Consultant": { titleFa: "مشاور محیط‌زیست", iconKey: "t:leaf" },
  "Law Firm": { titleFa: "دفتر حقوقی", iconKey: "t:briefcase" },
  "Notary Public": { titleFa: "دفترخانه اسناد رسمی", iconKey: "t:file" },
  "Lawyer & Law Firm": { titleFa: "وکیل و دفتر حقوقی", iconKey: "t:briefcase" },

  // ── Finance ───────────────────────────────────────────────────────────
  "Financial Consultant": { titleFa: "مشاور مالی", iconKey: "t:coin" },
  Bank: { titleFa: "بانک", iconKey: "t:cash" },
  Accountant: { titleFa: "حسابدار", iconKey: "t:chart-bar" },
  "Insurance Company": { titleFa: "شرکت بیمه", iconKey: "t:shield" },
  "Investing Service": {
    titleFa: "خدمات سرمایه‌گذاری",
    iconKey: "t:chart-line",
  },
  "Loan Service": { titleFa: "خدمات وام", iconKey: "t:credit-card" },
  "Credit Union": { titleFa: "صندوق اعتباری", iconKey: "t:cash" },
  "Finance Company": { titleFa: "شرکت مالی", iconKey: "t:chart-line" },
  "Investment Bank": { titleFa: "بانک سرمایه‌گذاری", iconKey: "t:chart-line" },
  "Retail Bank": { titleFa: "بانک خرد", iconKey: "t:cash" },

  // ── Education ─────────────────────────────────────────────────────────
  "Teacher / Educator": { titleFa: "معلم", iconKey: "t:school" },
  "Online Tutor": { titleFa: "تدریس خصوصی", iconKey: "t:book" },
  "Dance School": { titleFa: "آموزشگاه رقص", iconKey: "t:music" },
  School: { titleFa: "مدرسه", iconKey: "t:school" },
  University: { titleFa: "دانشگاه", iconKey: "t:school" },
  "College & University": { titleFa: "کالج و دانشگاه", iconKey: "t:school" },
  "Educational Consultant": { titleFa: "مشاور آموزشی", iconKey: "t:book" },
  "Tutor/Teacher": { titleFa: "معلم / مدرس", iconKey: "t:book" },
  "Language School": { titleFa: "آموزشگاه زبان", iconKey: "t:book" },
  "Music Lessons & Instruction School": {
    titleFa: "آموزشگاه موسیقی",
    iconKey: "t:music",
  },
  "Driving School": { titleFa: "آموزشگاه رانندگی", iconKey: "t:car" },
  Teacher: { titleFa: "معلم", iconKey: "t:school" },
  Education: { titleFa: "آموزش عمومی", iconKey: "t:school" },
  "Child Care Service": { titleFa: "خدمات نگهداری کودک", iconKey: "t:baby" },
  "Day Care": { titleFa: "مهدکودک", iconKey: "t:baby" },
  Library: { titleFa: "کتابخانه", iconKey: "t:book" },

  // ── Retail ────────────────────────────────────────────────────────────
  "E-Commerce Website": {
    titleFa: "فروشگاه اینترنتی",
    iconKey: "t:shopping-cart",
  },
  "Shopping & Retail": {
    titleFa: "خرید و خرده‌فروشی",
    iconKey: "t:shopping-bag",
  },
  "Baby & Children's Clothing Store": {
    titleFa: "پوشاک نوزاد و کودک",
    iconKey: "t:baby",
  },
  "Bags & Luggage Store": { titleFa: "کیف و چمدان", iconKey: "t:backpack" },
  "Candy Store": { titleFa: "آبنبات‌فروشی", iconKey: "t:candy" },
  Florist: { titleFa: "گل‌فروشی", iconKey: "t:flower" },
  "Footwear Store": { titleFa: "کفش‌فروشی", iconKey: "t:shopping-bag" },
  "Gift Shop": { titleFa: "فروشگاه هدایا", iconKey: "t:gift" },
  "Grocery Store": { titleFa: "خواربارفروشی", iconKey: "t:shopping-cart" },
  "Jewelry / Watches": { titleFa: "جواهرات و ساعت", iconKey: "t:diamond" },
  "Pet Store": { titleFa: "فروشگاه حیوانات خانگی", iconKey: "t:paw" },
  Supermarket: { titleFa: "سوپرمارکت", iconKey: "t:shopping-cart" },
  Accessories: { titleFa: "اکسسوری", iconKey: "t:diamond" },
  "Antique Store": { titleFa: "عتیقه‌فروشی", iconKey: "t:archive" },
  "Baby Goods / Kids Goods": {
    titleFa: "لوازم کودک و نوزاد",
    iconKey: "t:baby",
  },
  Bookstore: { titleFa: "کتاب‌فروشی", iconKey: "t:book" },
  "Convenience Store": { titleFa: "فروشگاه محلی", iconKey: "t:shopping-bag" },
  "Cosmetics Store": { titleFa: "فروشگاه لوازم آرایشی", iconKey: "t:sparkles" },
  "Department Store": { titleFa: "فروشگاه بزرگ", iconKey: "t:building" },
  "Electronics Store": {
    titleFa: "فروشگاه لوازم الکترونیکی",
    iconKey: "t:devices",
  },
  "Furniture Store": { titleFa: "فروشگاه مبلمان", iconKey: "t:sofa" },
  "Home Goods Store": { titleFa: "فروشگاه لوازم خانه", iconKey: "t:home" },
  "Toy Store": { titleFa: "اسباب‌بازی‌فروشی", iconKey: "t:dice" },
  "Gold & Jewelry Store": { titleFa: "طلا و جواهرفروشی", iconKey: "t:diamond" },
  Jewelry: { titleFa: "جواهرات", iconKey: "t:diamond" },
  "Baby Goods": { titleFa: "لوازم نوزاد", iconKey: "t:baby" },
  "Butcher Shop": { titleFa: "قصابی", iconKey: "t:meat" },
  "Camera Store": { titleFa: "فروشگاه دوربین", iconKey: "t:camera" },
  "Discount Store": { titleFa: "فروشگاه تخفیف", iconKey: "t:tag" },
  "Fabric Store": { titleFa: "پارچه‌فروشی", iconKey: "t:shopping-bag" },
  "Garden Center": { titleFa: "تجهیزات باغبانی", iconKey: "t:plant" },
  "Hardware Store": { titleFa: "ابزارفروشی", iconKey: "t:tools" },
  "Organic Grocery Store": {
    titleFa: "فروشگاه مواد ارگانیک",
    iconKey: "t:salad",
  },
  "Vintage Store": { titleFa: "فروشگاه وینتیج", iconKey: "t:archive" },

  // ── Agencies & Marketing ──────────────────────────────────────────────
  "Marketing Agency": { titleFa: "آژانس بازاریابی", iconKey: "t:speakerphone" },
  "Advertising Agency": {
    titleFa: "آژانس تبلیغاتی",
    iconKey: "t:speakerphone",
  },
  "Brand Agency": { titleFa: "آژانس برندینگ", iconKey: "t:sparkles" },
  "Internet Marketing Service": {
    titleFa: "خدمات بازاریابی آنلاین",
    iconKey: "t:world",
  },
  "Printing & Advertising": { titleFa: "چاپ و تبلیغات", iconKey: "t:printer" },
  "Publishing Company": { titleFa: "انتشارات", iconKey: "t:book" },

  // ── Real Estate ───────────────────────────────────────────────────────
  "Real Estate Company": { titleFa: "املاک", iconKey: "t:building" },
  "Apartment & Condo Building": {
    titleFa: "ساختمان مسکونی",
    iconKey: "t:building",
  },
  "Real Estate Agent": { titleFa: "مشاور املاک", iconKey: "t:home" },

  // ── Technology ────────────────────────────────────────────────────────
  "Software Company": { titleFa: "شرکت نرم‌افزاری", iconKey: "t:code" },
  "Tech Company": { titleFa: "شرکت فناوری", iconKey: "t:devices" },
  "App Page": { titleFa: "اپلیکیشن", iconKey: "t:mobile" },
  "Biotechnology Company": { titleFa: "شرکت بیوتکنولوژی", iconKey: "t:dna" },
  "Internet Company": { titleFa: "شرکت اینترنتی", iconKey: "t:world" },
  "Engineering Service": { titleFa: "خدمات مهندسی", iconKey: "t:tools" },
  Architect: { titleFa: "معمار", iconKey: "t:building" },
  Boat: { titleFa: "قایق", iconKey: "t:sailboat" },
  Gym: { titleFa: "باشگاه", iconKey: "t:basketball" },
  "Travel Company": { titleFa: "شرکت سفر", iconKey: "t:plane" },

  // ── Automotive ────────────────────────────────────────────────────────
  "Car Dealership": { titleFa: "نمایشگاه خودرو", iconKey: "t:car" },
  "Automotive Repair Shop": { titleFa: "تعمیرگاه خودرو", iconKey: "t:tools" },
  "Motor Vehicle Company": { titleFa: "شرکت خودروسازی", iconKey: "t:car" },
  "Car Wash & Detailing": { titleFa: "کارواش", iconKey: "t:droplet" },
  "Motorcycle Dealership": {
    titleFa: "نمایندگی موتورسیکلت",
    iconKey: "t:motorbike",
  },
  "Exotic Car Rental": { titleFa: "اجاره خودروی لوکس", iconKey: "t:car" },
  "Gas Station": { titleFa: "پمپ‌بنزین", iconKey: "t:fire-extinguisher" },

  // ── Home Services ─────────────────────────────────────────────────────
  "Cleaning Service": { titleFa: "خدمات نظافت", iconKey: "t:droplet" },
  "Landscape Company": { titleFa: "محوطه‌سازی", iconKey: "t:plant" },
  "Appliance Repair Service": {
    titleFa: "تعمیر لوازم خانگی",
    iconKey: "t:tools",
  },
  Contractor: { titleFa: "پیمانکار", iconKey: "t:hammer" },
  Electrician: { titleFa: "برق‌کار", iconKey: "t:bolt" },
  "Plumbing Service": { titleFa: "لوله‌کشی", iconKey: "t:droplet" },
  "Roofing Service": { titleFa: "خدمات سقف‌سازی", iconKey: "t:home" },
  "Construction Company": { titleFa: "شرکت ساختمانی", iconKey: "t:hammer" },
  "Dry Cleaner": { titleFa: "خشک‌شویی", iconKey: "t:droplet" },
  "Kitchen & Bath Contractor": {
    titleFa: "پیمانکار آشپزخانه و حمام",
    iconKey: "t:tools",
  },

  // ── Entertainment ─────────────────────────────────────────────────────
  "Comedy Club": { titleFa: "کلوب کمدی", iconKey: "t:smile" },
  Aquarium: { titleFa: "آکواریوم", iconKey: "t:fish" },
  "Board Game": { titleFa: "بازی رومیزی", iconKey: "t:dice" },
  "Botanical Garden": { titleFa: "باغ گیاه‌شناسی", iconKey: "t:plant" },
  "Amusement Park": { titleFa: "شهربازی", iconKey: "t:confetti" },
  "Art Gallery": { titleFa: "گالری هنری", iconKey: "t:palette" },
  Cinema: { titleFa: "سینما", iconKey: "t:video" },
  "Concert Tour": { titleFa: "تور کنسرت", iconKey: "t:music" },
  "Movie Theater": { titleFa: "سالن سینما", iconKey: "t:video" },
  Museum: { titleFa: "موزه", iconKey: "t:building" },
  "Theatrical Play": { titleFa: "تئاتر", iconKey: "t:user" },
  "Entertainment Website": { titleFa: "وب‌سایت سرگرمی", iconKey: "t:world" },
  "Escape Game Room": { titleFa: "اتاق فرار", iconKey: "t:puzzle" },
  "Race Track": { titleFa: "پیست مسابقه", iconKey: "t:flag" },
  "Talent Agency": { titleFa: "آژانس استعدادیابی", iconKey: "t:sparkles" },
  "Theme Park": { titleFa: "پارک موضوعی", iconKey: "t:confetti" },
  Zoo: { titleFa: "باغ وحش", iconKey: "t:paw" },

  // ── Events ────────────────────────────────────────────────────────────
  "Event Planner": { titleFa: "برگزارکننده رویداد", iconKey: "t:confetti" },
  "Wedding Planning Service": {
    titleFa: "خدمات برگزاری عروسی",
    iconKey: "t:confetti",
  },
  "Wedding Hall": { titleFa: "تالار عروسی", iconKey: "t:confetti" },

  // ── Travel & Tourism ──────────────────────────────────────────────────
  "Hotel & Lodging": { titleFa: "هتل و اقامتگاه", iconKey: "t:bed" },
  "Travel Company / Agency": { titleFa: "آژانس مسافرتی", iconKey: "t:plane" },
  "Beach Resort": { titleFa: "اقامتگاه ساحلی", iconKey: "t:umbrella" },
  "Tour Agency": { titleFa: "آژانس تور", iconKey: "t:luggage" },
  "Tourist Information Center": {
    titleFa: "مرکز اطلاعات گردشگری",
    iconKey: "t:map",
  },
  "Vacation Home Rental": { titleFa: "اجاره خانه ویلایی", iconKey: "t:home" },
  Hostel: { titleFa: "هاستل", iconKey: "t:bed" },
  "Cabin Rental": { titleFa: "اجاره کلبه جنگلی", iconKey: "t:home" },
  "National Park": { titleFa: "پارک ملی", iconKey: "t:tree" },
  "Sightseeing Tour Agency": { titleFa: "آژانس تور گردشگری", iconKey: "t:map" },

  // ── Media ─────────────────────────────────────────────────────────────
  Magazine: { titleFa: "مجله", iconKey: "t:news" },
  "Media Company": { titleFa: "شرکت رسانه‌ای", iconKey: "t:news" },
  Newspaper: { titleFa: "روزنامه", iconKey: "t:news" },
  "Radio Station": { titleFa: "ایستگاه رادیویی", iconKey: "t:microphone" },

  // ── Community & Nonprofit ─────────────────────────────────────────────
  "Nonprofit Organization": { titleFa: "سازمان مردم‌نهاد", iconKey: "t:heart" },
  "Charity Organization": { titleFa: "خیریه", iconKey: "t:heart" },
  "Religious Organization": { titleFa: "سازمان مذهبی", iconKey: "t:heart" },
  "Community Organization": { titleFa: "سازمان مردمی", iconKey: "t:users" },
  "Christian Church": { titleFa: "کلیسا", iconKey: "t:heart" },
  "Recycling Center": { titleFa: "مرکز بازیافت", iconKey: "t:refresh" },

  // ── Agriculture ───────────────────────────────────────────────────────
  Farm: { titleFa: "مزرعه", iconKey: "t:plant" },
  "Urban Farm": { titleFa: "کشاورزی شهری", iconKey: "t:plant" },

  // ── Food & Beverage extras ────────────────────────────────────────────
  "Canadian Restaurant": { titleFa: "رستوران کانادایی", iconKey: "t:soup" },
  "Colombian Restaurant": { titleFa: "رستوران کلمبیایی", iconKey: "t:soup" },
  "Health Food Restaurant": {
    titleFa: "رستوران غذای سالم",
    iconKey: "t:salad",
  },
};

// ---------------------------------------------------------------------------
// Old (29 legacy slugs) → New mapping
// ---------------------------------------------------------------------------

const LEGACY_MAP: Record<string, string | null> = {
  music: "musician-band",
  design: "graphic-designer",
  education: "online-tutor",
  coaching: "life-coach",
  shop: "shopping-retail",
  restaurant: "restaurant",
  doctor: "doctor",
  lawyer: "lawyer",
  consultant: "consultant",
  blogger: "blogger",
  athlete: "athlete",
  photographer: "photographer",
  developer: "software-company",
  salon: "hair-salon",
  content_creator: "digital-creator",
  fitness: "gym-physical-fitness-center",
  beauty: "beauty-salon",
  travel: "travel-company-agency",
  food: "chef",
  psychology: "therapist",
  artist: "artist",
  writer: "writer",
  financial: "financial-consultant",
  real_estate: "real-estate-company",
  cafe: "cafe",
  architect: "architect-architectural-designer",
  event: "event-planner",
  nonprofit: "nonprofit-organization",
  other: null,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USAGE_RANK: Record<string, number> = {
  "Very High": 0,
  High: 10,
  Medium: 20,
};

function slugifyEn(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/['’`]/g, "")
    .replace(/[\/\\]/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function normalizeCategoryName(raw: string): string {
  // "Online Tutor / تدریس خصوصی" → "Online Tutor", but keep
  // "Musician/Band" or "Travel Company / Agency" intact.
  return stripFaSuffix(raw);
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

function build(): SeedFile {
  const xlsxPath = path.resolve(
    process.cwd(),
    "Kioar_Categories_Final_2026.json",
  );
  const wb = JSON.parse(fs.readFileSync(xlsxPath, "utf8")) as Record<
    string,
    Array<Record<string, string | number>>
  >;
  const rows = wb["All Categories"];
  if (!rows) throw new Error("Sheet 'All Categories' not found");

  // Industry → which account_types appear in its categories
  const industryAccountTypes = new Map<string, Set<AccountType>>();
  const industryVeryHigh = new Map<string, number>();

  // Pre-pass: aggregate industry stats
  for (const row of rows) {
    const ind = normalizeIndustry(String(row["Industry Group"]));
    const at: AccountType =
      String(row["Account Type"]) === "Individual" ? "personal" : "business";
    const set = industryAccountTypes.get(ind) ?? new Set<AccountType>();
    set.add(at);
    industryAccountTypes.set(ind, set);
    if (String(row["Usage Level"]) === "Very High") {
      industryVeryHigh.set(ind, (industryVeryHigh.get(ind) ?? 0) + 1);
    }
  }

  // Industries: order by veryHigh desc, then by FA title asc
  const industries: IndustrySeed[] = [];
  const usedIndustries = [...industryAccountTypes.keys()];
  usedIndustries.sort((a, b) => {
    const diff =
      (industryVeryHigh.get(b) ?? 0) - (industryVeryHigh.get(a) ?? 0);
    if (diff !== 0) return diff;
    return INDUSTRY_META[a].titleFa.localeCompare(INDUSTRY_META[b].titleFa);
  });
  usedIndustries.forEach((en, idx) => {
    const meta = INDUSTRY_META[en];
    const ats = [...(industryAccountTypes.get(en) ?? [])];
    ats.sort(); // 'business', 'personal'
    industries.push({
      slug: meta.slug,
      titleFa: meta.titleFa,
      titleEn: en,
      iconKey: meta.iconKey,
      accountTypes: ats,
      sortOrder: idx * 10,
      isActive: true,
    });
  });

  // Categories
  const rawCats: Array<{
    industryEn: string;
    enName: string;
    accountType: AccountType;
    usage: string;
  }> = [];
  const missing: string[] = [];

  for (const row of rows) {
    const industryEn = normalizeIndustry(String(row["Industry Group"]));
    const enName = normalizeCategoryName(String(row["Category"]));
    const accountType: AccountType =
      String(row["Account Type"]) === "Individual" ? "personal" : "business";
    const usage = String(row["Usage Level"]);
    if (!CATEGORY_FA[enName]) {
      missing.push(`${industryEn} → ${enName}`);
      continue;
    }
    rawCats.push({ industryEn, enName, accountType, usage });
  }

  if (missing.length) {
    // Surface clearly so we never silently drop categories.
    console.error(
      "\n⚠️  Missing FA translations for the following categories:",
    );
    for (const m of missing) console.error("   - " + m);
    throw new Error(
      `Add ${missing.length} entries to CATEGORY_FA in scripts/build-categories-seed.ts`,
    );
  }

  // Slug uniqueness: most names are globally unique. If a collision occurs
  // across industries, prefix with industry slug per spec.
  const slugByEn = new Map<string, string>();
  const slugCount = new Map<string, number>();
  for (const c of rawCats) {
    const base = slugifyEn(c.enName);
    slugCount.set(base, (slugCount.get(base) ?? 0) + 1);
  }
  for (const c of rawCats) {
    const base = slugifyEn(c.enName);
    const slug =
      (slugCount.get(base) ?? 0) > 1
        ? `${INDUSTRY_META[c.industryEn].slug}-${base}`
        : base;
    slugByEn.set(`${c.industryEn}::${c.enName}`, slug);
  }

  // Sort categories within an industry: usage rank, then FA title
  rawCats.sort((a, b) => {
    if (a.industryEn !== b.industryEn) return 0; // grouping handled below
    const u = (USAGE_RANK[a.usage] ?? 99) - (USAGE_RANK[b.usage] ?? 99);
    if (u !== 0) return u;
    return CATEGORY_FA[a.enName].titleFa.localeCompare(
      CATEGORY_FA[b.enName].titleFa,
    );
  });

  // Re-bucket by industry to assign sort_order per industry
  const byIndustry = new Map<string, typeof rawCats>();
  for (const c of rawCats) {
    const arr = byIndustry.get(c.industryEn) ?? [];
    arr.push(c);
    byIndustry.set(c.industryEn, arr);
  }

  const categories: CategorySeed[] = [];
  for (const industryEn of usedIndustries) {
    const arr = byIndustry.get(industryEn) ?? [];
    arr.sort((a, b) => {
      const u = (USAGE_RANK[a.usage] ?? 99) - (USAGE_RANK[b.usage] ?? 99);
      if (u !== 0) return u;
      return CATEGORY_FA[a.enName].titleFa.localeCompare(
        CATEGORY_FA[b.enName].titleFa,
      );
    });
    arr.forEach((c, idx) => {
      const meta = CATEGORY_FA[c.enName];
      categories.push({
        industrySlug: INDUSTRY_META[c.industryEn].slug,
        slug: slugByEn.get(`${c.industryEn}::${c.enName}`)!,
        titleFa: meta.titleFa,
        titleEn: c.enName,
        iconKey: meta.iconKey,
        accountType: c.accountType,
        sortOrder: idx * 10,
        isActive: true,
      });
    });
  }

  return { industries, categories, legacyMap: LEGACY_MAP };
}

// ---------------------------------------------------------------------------
// Render SQL
// ---------------------------------------------------------------------------

function sqlEscape(s: string): string {
  return s.replace(/'/g, "''");
}

function renderMigrationSql(seed: SeedFile): string {
  const parts: string[] = [];

  parts.push(`-- ---------------------------------------------------------------------------
-- 0046_industries_categories
-- ---------------------------------------------------------------------------
-- Two-level taxonomy (industries → categories) sourced from Instagram's 2026
-- category list adapted for Iran. Replaces the flat \`discover_categories\`
-- table (29 rows) with 27 industries and ~190 categories.
--
-- Account-type ("personal" / "business") is per-category. Industries record
-- which account-types they contain so onboarding can filter chips by the
-- user's selected page type.
--
-- profiles.discover_category continues to store a slug — it now points at
-- categories.slug instead of discover_categories.slug. Existing slugs are
-- remapped in-place so live profiles continue to render their category.
--
-- Generated from scripts/build-categories-seed.ts on ${new Date().toISOString()}.
-- ---------------------------------------------------------------------------

CREATE TABLE "industries" (
\t"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
\t"slug" text NOT NULL,
\t"title_fa" text NOT NULL,
\t"title_en" text NOT NULL,
\t"icon_key" text DEFAULT 't:star' NOT NULL,
\t"account_types" text[] NOT NULL,
\t"sort_order" integer DEFAULT 0 NOT NULL,
\t"is_active" boolean DEFAULT true NOT NULL,
\t"created_at" timestamp with time zone DEFAULT now() NOT NULL,
\t"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
-->statement-breakpoint
CREATE UNIQUE INDEX "industries_slug_idx" ON "industries" ("slug");
-->statement-breakpoint
CREATE INDEX "industries_sort_idx" ON "industries" ("sort_order") WHERE "is_active" = true;
-->statement-breakpoint

CREATE TABLE "categories" (
\t"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
\t"industry_id" uuid NOT NULL REFERENCES "industries"("id") ON DELETE RESTRICT,
\t"slug" text NOT NULL,
\t"title_fa" text NOT NULL,
\t"title_en" text NOT NULL,
\t"icon_key" text DEFAULT 't:star' NOT NULL,
\t"account_type" text NOT NULL,
\t"sort_order" integer DEFAULT 0 NOT NULL,
\t"is_active" boolean DEFAULT true NOT NULL,
\t"created_at" timestamp with time zone DEFAULT now() NOT NULL,
\t"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
\tCONSTRAINT "categories_account_type_check"
\t\tCHECK ("account_type" IN ('personal','business'))
);
-->statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_idx" ON "categories" ("slug");
-->statement-breakpoint
CREATE INDEX "categories_industry_account_sort_idx"
\tON "categories" ("industry_id","account_type","sort_order")
\tWHERE "is_active" = true;
-->statement-breakpoint
`);

  // Seed industries
  parts.push(
    `-- Seed industries -----------------------------------------------------------`,
  );
  for (const ind of seed.industries) {
    const accTypes = `ARRAY[${ind.accountTypes.map((a) => `'${a}'`).join(",")}]::text[]`;
    parts.push(
      `INSERT INTO "industries" ("slug","title_fa","title_en","icon_key","account_types","sort_order","is_active") VALUES ` +
        `('${sqlEscape(ind.slug)}','${sqlEscape(ind.titleFa)}','${sqlEscape(ind.titleEn)}','${sqlEscape(ind.iconKey)}',${accTypes},${ind.sortOrder},${ind.isActive});`,
    );
  }
  parts.push(`-->statement-breakpoint`);

  // Seed categories
  parts.push(
    `-- Seed categories -----------------------------------------------------------`,
  );
  for (const c of seed.categories) {
    parts.push(
      `INSERT INTO "categories" ("industry_id","slug","title_fa","title_en","icon_key","account_type","sort_order","is_active") ` +
        `SELECT id, '${sqlEscape(c.slug)}', '${sqlEscape(c.titleFa)}', '${sqlEscape(c.titleEn)}', '${sqlEscape(c.iconKey)}', '${c.accountType}', ${c.sortOrder}, ${c.isActive} ` +
        `FROM "industries" WHERE "slug" = '${sqlEscape(c.industrySlug)}';`,
    );
  }
  parts.push(`-->statement-breakpoint`);

  // Remap profiles.discover_category from old slugs → new slugs
  parts.push(`-- Remap profiles.discover_category from legacy slugs to new categories.slug.
-- Any old slug with no semantic equivalent (NULL in legacyMap) is cleared.`);
  for (const [oldSlug, newSlug] of Object.entries(seed.legacyMap)) {
    if (newSlug === null) {
      parts.push(
        `UPDATE "profiles" SET "discover_category" = NULL WHERE "discover_category" = '${sqlEscape(oldSlug)}';`,
      );
    } else {
      parts.push(
        `UPDATE "profiles" SET "discover_category" = '${sqlEscape(newSlug)}' WHERE "discover_category" = '${sqlEscape(oldSlug)}';`,
      );
    }
  }
  parts.push(`-- Any remaining legacy slug (i.e. user-created in admin since launch)
-- that doesn't match a new category gets cleared to avoid dangling refs.
UPDATE "profiles" SET "discover_category" = NULL
\tWHERE "discover_category" IS NOT NULL
\t\tAND "discover_category" NOT IN (SELECT "slug" FROM "categories");`);
  parts.push(`-->statement-breakpoint`);

  // Drop legacy table
  parts.push(`-- Drop the legacy flat table after backfilling profiles.
DROP TABLE IF EXISTS "discover_categories";`);

  return parts.join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const seed = build();

  const dataDir = path.resolve(process.cwd(), "scripts/data");
  fs.mkdirSync(dataDir, { recursive: true });
  const seedJsonPath = path.join(dataDir, "categories-seed.json");
  fs.writeFileSync(seedJsonPath, JSON.stringify(seed, null, 2) + "\n", "utf8");

  const migrationPath = path.resolve(
    process.cwd(),
    "drizzle/0046_industries_categories.sql",
  );
  fs.writeFileSync(migrationPath, renderMigrationSql(seed), "utf8");

  console.log(`✓ wrote ${seedJsonPath}`);
  console.log(`✓ wrote ${migrationPath}`);
  console.log(
    `  industries=${seed.industries.length}, categories=${seed.categories.length}`,
  );
}

main();
