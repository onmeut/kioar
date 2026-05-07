/**
 * Legacy `/dashboard/pages/[pageId]/trial` → redirect to canonical `/trial`.
 *
 * The trial route no longer carries the page id in the URL — we resolve the
 * current page from the user's session/cookie instead. This file exists only
 * to handle stale links / bookmarks; once those die out it can be deleted.
 */
import { permanentRedirect } from "next/navigation";

export default function LegacyTrialRedirect() {
  permanentRedirect("/trial");
}
