export const siteConfig = {
  name: "کیوآر",
  shortName: "کیوآر",
  description:
    "پلتفرم کارت ویزیت دیجیتال فارسی با لینک عمومی، QR، ثبت‌نام رویداد و درخواست کارت فیزیکی یا NFC.",
};

export function getBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

export function absoluteUrl(path = "/") {
  const pathname = path.startsWith("/") ? path : `/${path}`;
  return `${getBaseUrl()}${pathname}`;
}

// Stable per-user URL printed on physical/NFC cards. Survives slug changes
// because `/u/{userId}` server-redirects to the user's current public slug.
export function userShortUrl(userId: string) {
  return absoluteUrl(`/u/${userId}`);
}
