import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getPublicProfileBySlug } from "@/lib/data";
import { profileShareUrl } from "@/lib/profile-domains";

import { IgInstallClient } from "./ig-install-client";

export const dynamic = "force-dynamic";

/**
 * Public "Easy Install to Instagram Bio" page.
 *
 * Linked from the dashboard share modal as
 * `https://kioar.com/ig/<slug>`. Anyone with the URL can land on a
 * single-purpose page that:
 *   1. Shows the user's public Kioar URL.
 *   2. On tap, copies it to the clipboard and tries to launch the
 *      Instagram app (web fallback on desktop).
 *
 * Intentionally minimal — no nav, no chrome — so the assistant
 * helping the creator paste the link can do so in three taps.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const profile = await getPublicProfileBySlug(slug);
  if (!profile) {
    return { title: "نصب آسان", robots: { index: false, follow: false } };
  }
  return {
    title: `نصب لینک ${profile.fullName || slug} در بیوی اینستاگرام`,
    description:
      "با یک تپ، لینک کیوآر را کپی کرده و در بیوی اینستاگرام پیست کنید.",
    robots: { index: false, follow: false },
  };
}

export default async function IgInstallPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const profile = await getPublicProfileBySlug(slug);
  if (!profile) notFound();

  const publicUrl = profileShareUrl(slug, profile.domain);
  const displayHost = publicUrl.replace(/^https?:\/\//, "");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-5 safe-pb safe-pt">
      <IgInstallClient publicUrl={publicUrl} displayHost={displayHost} />
    </main>
  );
}
