export type WizardPlatform = {
  key: string;
  label: string;
  prefix: string;
  usernameOnly: boolean;
  /** Placeholder shown inside the input */
  placeholder: string;
  /** Icon identifier matching lucide or inline SVG path */
  iconSlug: string;
  /**
   * Static URL prefix shown inside the input before the user's typed text.
   * E.g. "youtube.com/@" — shown as dim text, not editable.
   * Only set when `usernameOnly` is true and the URL shape is non-obvious.
   */
  inputPrefix?: string;
  /** Returns an error message if invalid, or null if valid/empty. */
  validate?: (value: string) => string | null;
};

function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function isValidUrl(v: string): boolean {
  const s = v.trim();
  if (!s) return true;
  try {
    const url = new URL(s.startsWith("http") ? s : `https://${s}`);
    return url.hostname.includes(".");
  } catch {
    return false;
  }
}

/**
 * Ordered for Iranian users: Telegram + Instagram first (top-right in RTL
 * grid = highest visual priority), then the rest.
 */
export const WIZARD_PLATFORMS: WizardPlatform[] = [
  {
    key: "telegram",
    label: "تلگرام",
    prefix: "https://t.me/",
    usernameOnly: true,
    placeholder: "Username",
    iconSlug: "telegram",
  },
  {
    key: "instagram",
    label: "اینستاگرام",
    prefix: "https://instagram.com/",
    usernameOnly: true,
    placeholder: "Username",
    iconSlug: "instagram",
  },
  {
    key: "whatsapp",
    label: "واتساپ",
    prefix: "https://wa.me/",
    usernameOnly: false,
    placeholder: "Phone number with country code",
    iconSlug: "whatsapp",
    validate: (v) => {
      if (!v.trim()) return null;
      return /^\+?\d{7,15}$/.test(v.trim().replace(/[\s\-()]/g, ""))
        ? null
        : "شماره معتبر نیست";
    },
  },
  {
    key: "youtube",
    label: "یوتیوب",
    prefix: "https://youtube.com/@",
    usernameOnly: true,
    placeholder: "Username",
    iconSlug: "youtube",
    inputPrefix: "youtube.com/@",
  },
  {
    key: "twitter",
    label: "ایکس",
    prefix: "https://x.com/",
    usernameOnly: true,
    placeholder: "Username",
    iconSlug: "x",
  },
  {
    key: "tiktok",
    label: "تیک‌تاک",
    prefix: "https://www.tiktok.com/@",
    usernameOnly: true,
    placeholder: "Username",
    iconSlug: "tiktok",
    inputPrefix: "tiktok.com/@",
  },
  {
    key: "linkedin",
    label: "لینکدین",
    prefix: "https://linkedin.com/",
    usernameOnly: false,
    placeholder: "linkedin.com/in/yourname",
    iconSlug: "linkedin",
    validate: (v) => {
      if (!v.trim()) return null;
      return isValidUrl(v) ? null : "لینک معتبر نیست";
    },
  },
  {
    key: "github",
    label: "گیت‌هاب",
    prefix: "https://github.com/",
    usernameOnly: true,
    placeholder: "Username",
    iconSlug: "github",
    inputPrefix: "github.com/",
  },
  {
    key: "website",
    label: "وب‌سایت",
    prefix: "https://",
    usernameOnly: false,
    placeholder: "https://yoursite.com",
    iconSlug: "website",
    validate: (v) => {
      if (!v.trim()) return null;
      return isValidUrl(v) ? null : "آدرس سایت معتبر نیست";
    },
  },
  {
    key: "spotify",
    label: "اسپاتیفای",
    prefix: "https://open.spotify.com/",
    usernameOnly: false,
    placeholder: "Spotify profile URL",
    iconSlug: "spotify",
    validate: (v) => {
      if (!v.trim()) return null;
      return isValidUrl(v) ? null : "لینک معتبر نیست";
    },
  },
  {
    key: "email",
    label: "ایمیل",
    prefix: "mailto:",
    usernameOnly: false,
    placeholder: "Email address",
    iconSlug: "email",
    validate: (v) => {
      if (!v.trim()) return null;
      return isValidEmail(v) ? null : "ایمیل معتبر نیست";
    },
  },
  {
    key: "phone",
    label: "تلفن",
    prefix: "tel:",
    usernameOnly: false,
    placeholder: "Phone number",
    iconSlug: "phone",
    validate: (v) => {
      if (!v.trim()) return null;
      return /^\+?\d{7,15}$/.test(v.trim().replace(/[\s\-()]/g, ""))
        ? null
        : "شماره معتبر نیست";
    },
  },
];
