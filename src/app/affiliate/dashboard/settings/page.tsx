/**
 * `/affiliate/dashboard/settings` — banking + contact info.
 */
import { eq } from "drizzle-orm";

import { SettingsForm } from "@/app/affiliate/dashboard/settings/settings-form";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/db";
import { affiliateProfiles, users } from "@/db/schema";
import { formatPhoneDisplay } from "@/lib/phone";
import { toPersianDigits } from "@/lib/persian";

export default async function AffiliateSettingsPage() {
  const viewer = await requireUser();
  const db = getDb();
  const [profile, user] = await Promise.all([
    db.query.affiliateProfiles.findFirst({
      where: eq(affiliateProfiles.userId, viewer.user.id),
    }),
    db.query.users.findFirst({
      where: eq(users.id, viewer.user.id),
      columns: { phone: true },
    }),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-violet-700">
          تنظیمات
        </p>
        <h1 className="mt-1 text-[clamp(22px,3.5vw,30px)] font-semibold tracking-tight">
          اطلاعات حساب همکاری
        </h1>
      </div>

      {/* Phone (read-only) */}
      <div className="rounded-3xl border border-hairline bg-paper-soft p-5">
        <p className="text-[11px] font-medium text-ink-soft">شماره موبایل</p>
        <p className="mt-1 font-mono text-[16px] font-bold text-ink" dir="ltr">
          {user?.phone ? toPersianDigits(formatPhoneDisplay(user.phone)) : "—"}
        </p>
        <p className="mt-2 text-[11px] text-ink-soft">
          همه‌ی پیامک‌های تأیید و واریز به همین شماره ارسال می‌شه.
        </p>
      </div>

      <div className="rounded-3xl border border-hairline bg-paper p-6">
        <h2 className="text-[15px] font-bold tracking-tight">اطلاعات بانکی</h2>
        <p className="mt-1 text-[12px] leading-6 text-ink-soft">
          روی صورت‌حساب رسمی استفاده می‌شه. اگه عوض بشه، روی تسویه‌های بعدی
          اعمال می‌شه نه روی تسویه‌های قبلاً ثبت‌شده.
        </p>
        <div className="mt-5">
          <SettingsForm
            defaults={{
              sheba: profile?.shebaNumber ?? "",
              holderName: profile?.accountHolderName ?? "",
              nationalId: profile?.nationalId ?? "",
              contactEmail: profile?.contactEmail ?? "",
            }}
          />
        </div>
      </div>
    </div>
  );
}
