import type { Route } from "next";

import { getCurrentViewer } from "@/lib/auth/session";

import { SiteHeaderClient } from "./site-header-client";

export async function SiteHeader() {
  const viewer = await getCurrentViewer();
  const isAuthed = Boolean(viewer?.user);
  const isComplete = Boolean(viewer?.profile?.isComplete);
  const displayName =
    viewer?.profile?.fullName?.trim() ||
    viewer?.user?.phone?.slice(-4) ||
    "کاربر";
  const displayInitial = displayName.trim().charAt(0) || "ک";
  const dashboardHref: Route = isComplete ? "/me" : "/start";

  return (
    <SiteHeaderClient
      isAuthed={isAuthed}
      isComplete={isComplete}
      displayInitial={displayInitial}
      dashboardHref={dashboardHref}
    />
  );
}
