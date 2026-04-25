import {
  CalendarIcon,
  FileTextIcon,
  GlobeIcon,
  LinkIcon,
  MailIcon,
  MessageCircleIcon,
  MusicIcon,
  PlayIcon,
  ShoppingBagIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

export type LinkKind = {
  icon: LucideIcon;
  label: string;
};

export function detectLinkKind(url: string, label: string): LinkKind {
  const host = safeHostname(url);
  const protocol = safeProtocol(url);

  if (protocol === "mailto:")
    return { icon: MailIcon, label: label || "ایمیل" };
  if (protocol === "tel:") return { icon: MessageCircleIcon, label };

  if (!host) return { icon: LinkIcon, label };

  if (
    /(^|\.)(youtube\.com|youtu\.be|vimeo\.com|twitch\.tv|aparat\.com)$/i.test(
      host,
    )
  )
    return { icon: PlayIcon, label };

  if (/(^|\.)(spotify\.com|soundcloud\.com|music\.apple\.com)$/i.test(host))
    return { icon: MusicIcon, label };

  if (
    /(^|\.)(instagram\.com|twitter\.com|x\.com|linkedin\.com|facebook\.com|threads\.net|tiktok\.com|t\.me|telegram\.me|wa\.me|whatsapp\.com|discord\.(com|gg))$/i.test(
      host,
    )
  )
    return { icon: UsersIcon, label };

  if (
    /(^|\.)(notion\.so|docs\.google\.com|drive\.google\.com|dropbox\.com|github\.com)$/i.test(
      host,
    )
  )
    return { icon: FileTextIcon, label };

  if (
    /(^|\.)(cal\.com|calendly\.com|lu\.ma|luma\.com|eventbrite\.com)$/i.test(
      host,
    )
  )
    return { icon: CalendarIcon, label };

  if (
    /(^|\.)(shopify\.com|etsy\.com|basalam\.com|digikala\.com|torob\.com)$/i.test(
      host,
    )
  )
    return { icon: ShoppingBagIcon, label };

  return { icon: GlobeIcon, label };
}

export function getHostname(url: string): string | null {
  return safeHostname(url);
}

function safeHostname(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
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
