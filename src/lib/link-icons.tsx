import type { ComponentType, SVGProps } from "react";

import {
  CalendarIcon,
  FileTextIcon,
  GlobeIcon,
  LinkIcon,
  MailIcon,
  MessageCircleIcon,
  MusicIcon,
  PhoneIcon,
  PlayIcon,
  ShoppingBagIcon,
  UsersIcon,
  type LucideProps,
} from "lucide-react";

import { getTablerIcon, isTablerIconKey } from "@/lib/link-icons-tabler";

/**
 * Icon catalog for the links-in-bio editor.
 *
 * A "link icon" is either:
 *   1. A built-in entry from this catalog (keyed by `IconKey`), or
 *   2. A custom user upload (handled separately via `customIconUrl`), or
 *   3. The cover image (rendered instead when present).
 *
 * Auto-detection: `detectIconKey(url)` inspects the URL host and picks the
 * best matching icon. The editor stores the detected key as `iconKey = "auto"`
 * by default; the resolver re-evaluates on render so the icon follows the URL.
 */

export type IconCategory =
  | "general"
  | "social"
  | "messaging"
  | "media"
  | "commerce"
  | "productivity"
  | "contact";

export type IconEntry = {
  key: IconKey;
  label: string;
  category: IconCategory;
  /** Brand color for filled/tinted variants. */
  color: string;
  Icon: ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>;
  /** Hostname regex(es) used by auto-detection. */
  match?: RegExp;
  /** URL protocol used by auto-detection (e.g. "mailto:"). */
  protocol?: string;
};

/**
 * Built-in icon keys plus a fallback `string` to allow generic Tabler keys
 * (e.g. `t:rocket`) without forcing every consumer to widen.
 */
export type IconKey = BuiltInIconKey | (string & {});

export type BuiltInIconKey =
  | "auto"
  | "link"
  | "website"
  | "email"
  | "phone"
  | "sms"
  | "calendar"
  | "document"
  | "music"
  | "video"
  | "shop"
  | "people"
  | "chat"
  | "instagram"
  | "telegram"
  | "whatsapp"
  | "x"
  | "facebook"
  | "linkedin"
  | "youtube"
  | "tiktok"
  | "threads"
  | "github"
  | "discord"
  | "twitch"
  | "pinterest"
  | "reddit"
  | "snapchat"
  | "signal"
  | "bluesky"
  | "mastodon"
  | "medium"
  | "substack"
  | "dribbble"
  | "behance"
  | "figma"
  | "notion"
  | "spotify"
  | "applemusic"
  | "soundcloud"
  | "vimeo"
  | "aparat"
  | "eitaa"
  | "bale"
  | "rubika"
  | "soroush"
  | "basalam"
  | "digikala"
  | "snapp"
  | "torob"
  | "cafebazaar";

type BrandProps = SVGProps<SVGSVGElement> & { size?: number | string };

/* --------- Brand icon aliases (powered by Tabler) --------- */

import {
  IconBrandInstagram,
  IconBrandTelegram,
  IconBrandWhatsapp,
  IconBrandX,
  IconBrandFacebook,
  IconBrandLinkedin,
  IconBrandYoutube,
  IconBrandTiktok,
  IconBrandThreads,
  IconBrandGithub,
  IconBrandDiscord,
  IconBrandTwitch,
  IconBrandPinterest,
  IconBrandReddit,
  IconBrandSnapchat,
  IconBrandBluesky,
  IconBrandMastodon,
  IconBrandMedium,
  IconBrandDribbble,
  IconBrandBehance,
  IconBrandFigma,
  IconBrandNotion,
  IconBrandSpotify,
  IconBrandSoundcloud,
  IconBrandVimeo,
  IconBrandApple,
  IconShieldLock,
  IconNotebook,
  IconShoppingBag,
  IconShoppingCart,
  IconCar,
  IconSearch,
  IconBuildingStore,
} from "@tabler/icons-react";

type TablerProps = BrandProps & { stroke?: number | string };
const wrap = (
  Tabler: ComponentType<TablerProps>,
): ComponentType<BrandProps> => {
  const W = (props: BrandProps) => (
    <Tabler stroke={2 as unknown as string} {...props} />
  );
  W.displayName = (
    Tabler as ComponentType & { displayName?: string }
  ).displayName;
  return W;
};

const InstagramBrand = wrap(IconBrandInstagram);
const TelegramBrand = wrap(IconBrandTelegram);
const WhatsappBrand = wrap(IconBrandWhatsapp);
const XBrand = wrap(IconBrandX);
const FacebookBrand = wrap(IconBrandFacebook);
const LinkedinBrand = wrap(IconBrandLinkedin);
const YoutubeBrand = wrap(IconBrandYoutube);
const TiktokBrand = wrap(IconBrandTiktok);
const ThreadsBrand = wrap(IconBrandThreads);
const GithubBrand = wrap(IconBrandGithub);
const DiscordBrand = wrap(IconBrandDiscord);
const TwitchBrand = wrap(IconBrandTwitch);
const PinterestBrand = wrap(IconBrandPinterest);
const RedditBrand = wrap(IconBrandReddit);
const SnapchatBrand = wrap(IconBrandSnapchat);
const SignalBrand = wrap(IconShieldLock);
const BlueskyBrand = wrap(IconBrandBluesky);
const MastodonBrand = wrap(IconBrandMastodon);
const MediumBrand = wrap(IconBrandMedium);
const SubstackBrand = wrap(IconNotebook);
const DribbbleBrand = wrap(IconBrandDribbble);
const BehanceBrand = wrap(IconBrandBehance);
const FigmaBrand = wrap(IconBrandFigma);
const NotionBrand = wrap(IconBrandNotion);
const SpotifyBrand = wrap(IconBrandSpotify);
const AppleMusicBrand = wrap(IconBrandApple);
const SoundcloudBrand = wrap(IconBrandSoundcloud);
const VimeoBrand = wrap(IconBrandVimeo);
const AparatBrand = wrap(IconBrandYoutube);
const EitaaBrand = wrap(IconBrandTelegram);
const BaleBrand = wrap(IconBrandTelegram);
const RubikaBrand = wrap(IconBrandTelegram);
const SoroushBrand = wrap(IconBrandTelegram);
const BasalamBrand = wrap(IconShoppingBag);
const DigikalaBrand = wrap(IconShoppingCart);
const SnappBrand = wrap(IconCar);
const TorobBrand = wrap(IconSearch);
const CafeBazaarBrand = wrap(IconBuildingStore);

/* --------- Registry --------- */

export const ICON_REGISTRY: Record<BuiltInIconKey, IconEntry> = {
  auto: {
    key: "auto",
    label: "تشخیص خودکار",
    category: "general",
    color: "var(--primary)",
    Icon: (props) => <LinkIcon {...(props as LucideProps)} />,
  },
  link: {
    key: "link",
    label: "لینک",
    category: "general",
    color: "#64748b",
    Icon: (props) => <LinkIcon {...(props as LucideProps)} />,
  },
  website: {
    key: "website",
    label: "وب‌سایت",
    category: "general",
    color: "#0ea5e9",
    Icon: (props) => <GlobeIcon {...(props as LucideProps)} />,
  },
  email: {
    key: "email",
    label: "ایمیل",
    category: "contact",
    color: "#ef4444",
    Icon: (props) => <MailIcon {...(props as LucideProps)} />,
    protocol: "mailto:",
  },
  phone: {
    key: "phone",
    label: "تماس",
    category: "contact",
    color: "#10b981",
    Icon: (props) => <PhoneIcon {...(props as LucideProps)} />,
    protocol: "tel:",
  },
  sms: {
    key: "sms",
    label: "پیامک",
    category: "contact",
    color: "#22c55e",
    Icon: (props) => <MessageCircleIcon {...(props as LucideProps)} />,
    protocol: "sms:",
  },
  calendar: {
    key: "calendar",
    label: "تقویم",
    category: "productivity",
    color: "#f59e0b",
    Icon: (props) => <CalendarIcon {...(props as LucideProps)} />,
    match: /(^|\.)(cal\.com|calendly\.com|lu\.ma|luma\.com|eventbrite\.com)$/i,
  },
  document: {
    key: "document",
    label: "سند",
    category: "productivity",
    color: "#6366f1",
    Icon: (props) => <FileTextIcon {...(props as LucideProps)} />,
    match: /(^|\.)(docs\.google\.com|drive\.google\.com|dropbox\.com)$/i,
  },
  music: {
    key: "music",
    label: "موسیقی",
    category: "media",
    color: "#ec4899",
    Icon: (props) => <MusicIcon {...(props as LucideProps)} />,
  },
  video: {
    key: "video",
    label: "ویدیو",
    category: "media",
    color: "#f43f5e",
    Icon: (props) => <PlayIcon {...(props as LucideProps)} />,
  },
  shop: {
    key: "shop",
    label: "فروشگاه",
    category: "commerce",
    color: "#f97316",
    Icon: (props) => <ShoppingBagIcon {...(props as LucideProps)} />,
  },
  people: {
    key: "people",
    label: "شبکه اجتماعی",
    category: "social",
    color: "#8b5cf6",
    Icon: (props) => <UsersIcon {...(props as LucideProps)} />,
  },
  chat: {
    key: "chat",
    label: "گفت‌وگو",
    category: "messaging",
    color: "#14b8a6",
    Icon: (props) => <MessageCircleIcon {...(props as LucideProps)} />,
  },

  instagram: {
    key: "instagram",
    label: "اینستاگرام",
    category: "social",
    color: "#E4405F",
    Icon: InstagramBrand,
    match: /(^|\.)instagram\.com$/i,
  },
  telegram: {
    key: "telegram",
    label: "تلگرام",
    category: "messaging",
    color: "#26A5E4",
    Icon: TelegramBrand,
    match: /(^|\.)(t\.me|telegram\.me|telegram\.org)$/i,
  },
  whatsapp: {
    key: "whatsapp",
    label: "واتساپ",
    category: "messaging",
    color: "#25D366",
    Icon: WhatsappBrand,
    match: /(^|\.)(wa\.me|whatsapp\.com|api\.whatsapp\.com)$/i,
  },
  x: {
    key: "x",
    label: "ایکس (توییتر)",
    category: "social",
    color: "#000000",
    Icon: XBrand,
    match: /(^|\.)(twitter\.com|x\.com)$/i,
  },
  facebook: {
    key: "facebook",
    label: "فیسبوک",
    category: "social",
    color: "#1877F2",
    Icon: FacebookBrand,
    match: /(^|\.)(facebook\.com|fb\.com|fb\.me)$/i,
  },
  linkedin: {
    key: "linkedin",
    label: "لینکدین",
    category: "social",
    color: "#0A66C2",
    Icon: LinkedinBrand,
    match: /(^|\.)(linkedin\.com|lnkd\.in)$/i,
  },
  youtube: {
    key: "youtube",
    label: "یوتیوب",
    category: "media",
    color: "#FF0000",
    Icon: YoutubeBrand,
    match: /(^|\.)(youtube\.com|youtu\.be)$/i,
  },
  tiktok: {
    key: "tiktok",
    label: "تیک‌تاک",
    category: "social",
    color: "#000000",
    Icon: TiktokBrand,
    match: /(^|\.)tiktok\.com$/i,
  },
  threads: {
    key: "threads",
    label: "تردز",
    category: "social",
    color: "#000000",
    Icon: ThreadsBrand,
    match: /(^|\.)threads\.net$/i,
  },
  github: {
    key: "github",
    label: "گیت‌هاب",
    category: "productivity",
    color: "#181717",
    Icon: GithubBrand,
    match: /(^|\.)github\.com$/i,
  },
  discord: {
    key: "discord",
    label: "دیسکورد",
    category: "messaging",
    color: "#5865F2",
    Icon: DiscordBrand,
    match: /(^|\.)(discord\.com|discord\.gg)$/i,
  },
  twitch: {
    key: "twitch",
    label: "تویچ",
    category: "media",
    color: "#9146FF",
    Icon: TwitchBrand,
    match: /(^|\.)twitch\.tv$/i,
  },
  pinterest: {
    key: "pinterest",
    label: "پینترست",
    category: "social",
    color: "#BD081C",
    Icon: PinterestBrand,
    match: /(^|\.)(pinterest\.com|pin\.it)$/i,
  },
  reddit: {
    key: "reddit",
    label: "ردیت",
    category: "social",
    color: "#FF4500",
    Icon: RedditBrand,
    match: /(^|\.)reddit\.com$/i,
  },
  snapchat: {
    key: "snapchat",
    label: "اسنپ‌چت",
    category: "social",
    color: "#FFFC00",
    Icon: SnapchatBrand,
    match: /(^|\.)snapchat\.com$/i,
  },
  signal: {
    key: "signal",
    label: "سیگنال",
    category: "messaging",
    color: "#3A76F0",
    Icon: SignalBrand,
    match: /(^|\.)signal\.(me|org)$/i,
  },
  bluesky: {
    key: "bluesky",
    label: "بلواسکای",
    category: "social",
    color: "#0085FF",
    Icon: BlueskyBrand,
    match: /(^|\.)bsky\.app$/i,
  },
  mastodon: {
    key: "mastodon",
    label: "ماستودون",
    category: "social",
    color: "#6364FF",
    Icon: MastodonBrand,
    match: /(^|\.)(mastodon\.(social|online|xyz)|mstdn\.social)$/i,
  },
  medium: {
    key: "medium",
    label: "مدیوم",
    category: "productivity",
    color: "#000000",
    Icon: MediumBrand,
    match: /(^|\.)medium\.com$/i,
  },
  substack: {
    key: "substack",
    label: "ساب‌استک",
    category: "productivity",
    color: "#FF6719",
    Icon: SubstackBrand,
    match: /(^|\.)substack\.com$/i,
  },
  dribbble: {
    key: "dribbble",
    label: "دریبل",
    category: "productivity",
    color: "#EA4C89",
    Icon: DribbbleBrand,
    match: /(^|\.)dribbble\.com$/i,
  },
  behance: {
    key: "behance",
    label: "بی‌هنس",
    category: "productivity",
    color: "#1769FF",
    Icon: BehanceBrand,
    match: /(^|\.)behance\.net$/i,
  },
  figma: {
    key: "figma",
    label: "فیگما",
    category: "productivity",
    color: "#F24E1E",
    Icon: FigmaBrand,
    match: /(^|\.)figma\.com$/i,
  },
  notion: {
    key: "notion",
    label: "نوشن",
    category: "productivity",
    color: "#000000",
    Icon: NotionBrand,
    match: /(^|\.)notion\.(so|site)$/i,
  },
  spotify: {
    key: "spotify",
    label: "اسپاتیفای",
    category: "media",
    color: "#1DB954",
    Icon: SpotifyBrand,
    match: /(^|\.)spotify\.com$/i,
  },
  applemusic: {
    key: "applemusic",
    label: "اپل موزیک",
    category: "media",
    color: "#FA243C",
    Icon: AppleMusicBrand,
    match: /(^|\.)music\.apple\.com$/i,
  },
  soundcloud: {
    key: "soundcloud",
    label: "ساندکلود",
    category: "media",
    color: "#FF5500",
    Icon: SoundcloudBrand,
    match: /(^|\.)soundcloud\.com$/i,
  },
  vimeo: {
    key: "vimeo",
    label: "ویمیو",
    category: "media",
    color: "#1AB7EA",
    Icon: VimeoBrand,
    match: /(^|\.)vimeo\.com$/i,
  },
  aparat: {
    key: "aparat",
    label: "آپارات",
    category: "media",
    color: "#D12525",
    Icon: AparatBrand,
    match: /(^|\.)aparat\.com$/i,
  },
  eitaa: {
    key: "eitaa",
    label: "ایتا",
    category: "messaging",
    color: "#5BA0E3",
    Icon: EitaaBrand,
    match: /(^|\.)eitaa\.com$/i,
  },
  bale: {
    key: "bale",
    label: "بله",
    category: "messaging",
    color: "#00BAD2",
    Icon: BaleBrand,
    match: /(^|\.)ble\.ir$/i,
  },
  rubika: {
    key: "rubika",
    label: "روبیکا",
    category: "messaging",
    color: "#E2342B",
    Icon: RubikaBrand,
    match: /(^|\.)rubika\.ir$/i,
  },
  soroush: {
    key: "soroush",
    label: "سروش",
    category: "messaging",
    color: "#3A74E9",
    Icon: SoroushBrand,
    match: /(^|\.)(splus\.ir|sapp\.ir|soroush-app\.ir)$/i,
  },
  basalam: {
    key: "basalam",
    label: "باسلام",
    category: "commerce",
    color: "#F48020",
    Icon: BasalamBrand,
    match: /(^|\.)basalam\.com$/i,
  },
  digikala: {
    key: "digikala",
    label: "دیجی‌کالا",
    category: "commerce",
    color: "#EF4056",
    Icon: DigikalaBrand,
    match: /(^|\.)digikala\.com$/i,
  },
  snapp: {
    key: "snapp",
    label: "اسنپ",
    category: "commerce",
    color: "#00D67D",
    Icon: SnappBrand,
    match: /(^|\.)(snapp\.market|snapp\.ir)$/i,
  },
  torob: {
    key: "torob",
    label: "ترب",
    category: "commerce",
    color: "#F53C3C",
    Icon: TorobBrand,
    match: /(^|\.)torob\.com$/i,
  },
  cafebazaar: {
    key: "cafebazaar",
    label: "کافه بازار",
    category: "commerce",
    color: "#0BA882",
    Icon: CafeBazaarBrand,
    match: /(^|\.)(cafebazaar\.ir|myket\.ir)$/i,
  },
};

/* --------- Helpers --------- */

export const ICON_KEYS = Object.keys(ICON_REGISTRY) as BuiltInIconKey[];

export function isIconKey(value: unknown): value is IconKey {
  if (typeof value !== "string") return false;
  if (value in ICON_REGISTRY) return true;
  return isTablerIconKey(value);
}

function safeHost(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./i, "");
  } catch {
    return null;
  }
}

function safeProtocol(url: string): string | null {
  try {
    return new URL(url).protocol;
  } catch {
    return null;
  }
}

/**
 * Returns the best-matching catalog entry for a given URL. Never returns
 * `auto`; the `auto` key means "re-detect at render time".
 */
export function detectIconKey(url: string | null | undefined): BuiltInIconKey {
  if (!url) return "link";
  const trimmed = url.trim();
  if (!trimmed) return "link";

  const protocol = safeProtocol(trimmed);
  if (protocol === "mailto:") return "email";
  if (protocol === "tel:") return "phone";
  if (protocol === "sms:") return "sms";

  const host = safeHost(trimmed);
  if (!host) return "link";

  for (const entry of Object.values(ICON_REGISTRY)) {
    if (entry.match && entry.match.test(host)) {
      return entry.key as BuiltInIconKey;
    }
  }

  return "website";
}

/**
 * Resolves the icon entry to render. When `key === "auto"` or the key is
 * unknown, this re-runs detection against the URL. Supports `t:<name>`
 * generic Tabler icon keys.
 */
export function resolveIconEntry(
  key: IconKey | null | undefined,
  url: string | null | undefined,
): IconEntry {
  if (key && key !== "auto") {
    if (key in ICON_REGISTRY) {
      return ICON_REGISTRY[key as BuiltInIconKey];
    }
    const tabler = getTablerIcon(key);
    if (tabler) {
      const TablerComp = tabler as unknown as ComponentType<
        SVGProps<SVGSVGElement> & { size?: number | string }
      >;
      return {
        key,
        label: "",
        category: "general",
        color: "#0f172a",
        Icon: (props) => <TablerComp {...props} />,
      } satisfies IconEntry;
    }
  }
  const detected = detectIconKey(url);
  return ICON_REGISTRY[detected];
}

export const ICON_CATEGORY_LABELS: Record<IconCategory, string> = {
  general: "عمومی",
  social: "شبکه‌های اجتماعی",
  messaging: "پیام‌رسان",
  media: "رسانه",
  commerce: "فروشگاه",
  productivity: "ابزار و کار",
  contact: "تماس",
};

export const CATEGORIES: IconCategory[] = [
  "general",
  "social",
  "messaging",
  "media",
  "commerce",
  "productivity",
  "contact",
];
