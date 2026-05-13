import { redirect } from "next/navigation";

// Authenticated shell — redirect-only, no direct session call.
export const dynamic = "force-dynamic";

export default function UserProfilePage() {
  redirect("/account");
}
