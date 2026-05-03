import { CheckCircle2Icon } from "lucide-react";

import { CardRequestForm } from "@/components/dashboard/card-request-form";
import { requireCompletedProfile } from "@/lib/auth/session";

export default async function PremiumCardPage({
  searchParams,
}: {
  searchParams: Promise<{
    sent?: string;
  }>;
}) {
  const viewer = await requireCompletedProfile();
  const params = await searchParams;

  return (
    <div className="section-shell space-y-5 py-6">
      {params.sent === "1" ? (
        <div className="flex items-center gap-2 rounded-3xl bg-primary/10 px-4 py-3 text-sm text-primary">
          <CheckCircle2Icon className="size-4" />
          درخواست شما ثبت شد و در پنل داخلی قابل مشاهده است.
        </div>
      ) : null}

      <CardRequestForm
        fullName={viewer.profile.fullName || ""}
        phone={viewer.profile.publicPhone || viewer.user.phone}
      />
    </div>
  );
}
