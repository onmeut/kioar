import Link from "next/link";
import type { Route } from "next";
import { CheckCircle2Icon, PhoneIcon, XCircleIcon } from "lucide-react";

import { updateRegistrationStatusAction } from "@/app/admin/events/actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { formatPersianDateTime, toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";

type Registration = {
  registrationId: string;
  status: "registered" | "cancelled";
  registeredAt: Date;
  userId: string;
  phone: string;
  role: "user" | "admin";
  profileSlug: string | null;
  fullName: string | null;
  profileTitle: string | null;
  avatarUrl: string | null;
  email: string | null;
};

function initials(name: string | null, phone: string) {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return parts
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }
  return phone.slice(-2);
}

export function EventParticipantsList({
  eventId,
  registrations,
}: {
  eventId: string;
  registrations: Registration[];
}) {
  if (registrations.length === 0) {
    return (
      <EmptyState
        icon={PhoneIcon}
        title="هنوز کسی ثبت‌نام نکرده است"
        description="وقتی کاربران در صفحه عمومی رویداد ثبت‌نام کنند، لیست آن‌ها اینجا ظاهر می‌شود."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-[1.8rem] border border-border/70 bg-background/70">
      <div className="hidden grid-cols-[2.4fr_1fr_1.1fr_0.9fr] gap-3 border-b border-border/60 px-5 py-3 text-xs font-semibold text-muted-foreground lg:grid">
        <span>شرکت‌کننده</span>
        <span>وضعیت</span>
        <span>زمان ثبت‌نام</span>
        <span className="text-left">اقدام</span>
      </div>
      <ul className="divide-y divide-border/60">
        {registrations.map((registration) => {
          const isCancelled = registration.status === "cancelled";
          const displayName = registration.fullName ?? "بدون پروفایل";
          return (
            <li
              key={registration.registrationId}
              className="grid gap-3 px-4 py-4 sm:px-5 lg:grid-cols-[2.4fr_1fr_1.1fr_0.9fr] lg:items-center"
            >
              <div className="flex items-center gap-3">
                <Avatar size="lg">
                  {registration.avatarUrl ? (
                    <AvatarImage
                      src={registration.avatarUrl}
                      alt={displayName}
                    />
                  ) : null}
                  <AvatarFallback>
                    {initials(registration.fullName, registration.phone)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-semibold">
                      {displayName}
                    </span>
                    {registration.role === "admin" ? (
                      <Badge className="rounded-full bg-primary/10 text-primary">
                        ادمین
                      </Badge>
                    ) : null}
                    {registration.profileSlug ? (
                      <Link
                        href={`/${registration.profileSlug}` as Route}
                        className="text-xs font-semibold text-primary hover:underline"
                        target="_blank"
                      >
                        مشاهده پروفایل
                      </Link>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span dir="ltr">{toPersianDigits(registration.phone)}</span>
                    {registration.profileTitle ? (
                      <span className="truncate">
                        {registration.profileTitle}
                      </span>
                    ) : null}
                    {registration.email ? (
                      <span className="truncate">{registration.email}</span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div>
                <Badge
                  className={cn(
                    "rounded-full",
                    isCancelled
                      ? "bg-destructive/10 text-destructive"
                      : "bg-emerald-500/12 text-emerald-700",
                  )}
                >
                  {isCancelled ? "لغوشده" : "ثبت‌نام شده"}
                </Badge>
              </div>

              <div className="text-xs text-muted-foreground">
                {formatPersianDateTime(registration.registeredAt)}
              </div>

              <div className="flex items-center justify-start gap-2 lg:justify-end">
                <form action={updateRegistrationStatusAction}>
                  <input
                    type="hidden"
                    name="registrationId"
                    value={registration.registrationId}
                  />
                  <input type="hidden" name="eventId" value={eventId} />
                  <input
                    type="hidden"
                    name="status"
                    value={isCancelled ? "registered" : "cancelled"}
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-9 rounded-full",
                      isCancelled
                        ? "text-emerald-700"
                        : "text-destructive hover:text-destructive",
                    )}
                  >
                    {isCancelled ? (
                      <>
                        <CheckCircle2Icon className="size-4" />
                        بازگردانی
                      </>
                    ) : (
                      <>
                        <XCircleIcon className="size-4" />
                        لغو ثبت‌نام
                      </>
                    )}
                  </Button>
                </form>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
