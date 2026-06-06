import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangleIcon,
  ArrowUpLeftIcon,
  BanIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  ExternalLinkIcon,
  Link2Icon,
  LogInIcon,
  ShieldCheckIcon,
  Trash2Icon,
  UserIcon,
} from "lucide-react";

import {
  adminBanUserAction,
  adminDeleteUserAction,
  adminStartImpersonationAction,
  adminUnbanUserAction,
  adminUpdateUserProfileRedirectAction,
  adminUpdateUserRoleAction,
} from "@/app/admin/users/actions";
import { BanUserForm } from "@/components/admin/ban-user-form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requireAdmin } from "@/lib/auth/session";
import { getAdminUserDetail } from "@/lib/data";
import {
  formatPersianDate,
  formatPersianDateTime,
  toPersianDigits,
} from "@/lib/persian";
import { formatPhoneDisplay } from "@/lib/phone";
import { absoluteUrl } from "@/lib/site";
import { cn } from "@/lib/utils";

function getInitials(name: string | null, fallback: string) {
  if (!name) return fallback.slice(-2);
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback.slice(-2);
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] + parts[parts.length - 1][0]).slice(0, 2);
}

export default async function AdminUserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    saved?: string;
    impersonate?: string;
    pageId?: string;
  }>;
}) {
  const viewer = await requireAdmin();
  const { id } = await params;
  const { saved, impersonate, pageId: pageIdParam } = await searchParams;

  const detail = await getAdminUserDetail(id, pageIdParam);
  if (!detail) notFound();

  const {
    user,
    profile,
    pages,
    pagePlans,
    links,
    registrations,
    recentSessions,
  } = detail;

  const displayName = profile?.fullName || user.phone;
  const isSelf = user.id === viewer.user.id;
  const isBanned = Boolean(user.bannedAt);
  const publicUrl = profile?.slug ? absoluteUrl(`/${profile.slug}`) : null;

  return (
    <div className="section-shell space-y-6 py-6">
      <div>
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowUpLeftIcon className="size-3" />
          بازگشت به لیست کاربران
        </Link>
      </div>

      {saved === "1" ? (
        <Flash tone="success">تغییرات با موفقیت ذخیره شد.</Flash>
      ) : null}
      {impersonate === "error" ? (
        <Flash tone="error">
          نمی‌توان به حساب این کاربر وارد شد (شاید ادمین یا مسدود باشد).
        </Flash>
      ) : null}

      {isBanned ? (
        <div className="flex flex-col gap-3 rounded-3xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <BanIcon className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="font-bold">این کاربر مسدود است</p>
              <p className="text-sm">
                از تاریخ {formatPersianDateTime(user.bannedAt!)}
                {user.bannedReason ? ` — ${user.bannedReason}` : ""}
              </p>
            </div>
          </div>
          <form action={adminUnbanUserAction}>
            <input type="hidden" name="userId" value={user.id} />
            <Button variant="outline" size="sm" className="h-9">
              <CheckCircle2Icon className="size-4" />
              رفع مسدودیت
            </Button>
          </form>
        </div>
      ) : null}

      {/* Header card */}
      <section className="rounded-4xl bg-card p-5 border border-border">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <Avatar className="size-16">
              {profile?.avatarUrl ? (
                <AvatarImage src={profile.avatarUrl} alt="" />
              ) : null}
              <AvatarFallback className="text-lg font-bold">
                {getInitials(profile?.fullName ?? null, user.phone)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold sm:text-2xl">{displayName}</h2>
                {user.role === "admin" ? (
                  <Badge className="gap-1 rounded-full bg-primary/15 text-primary">
                    <ShieldCheckIcon className="size-3" /> ادمین
                  </Badge>
                ) : null}
                {isBanned ? (
                  <Badge className="gap-1 rounded-full bg-rose-500/15 text-rose-700">
                    <BanIcon className="size-3" /> مسدود
                  </Badge>
                ) : profile?.isComplete ? (
                  <Badge className="gap-1 rounded-full bg-muted">
                    <UserIcon className="size-3" /> فعال
                  </Badge>
                ) : (
                  <Badge className="gap-1 rounded-full bg-amber-500/15 text-amber-700">
                    پروفایل ناقص
                  </Badge>
                )}
              </div>
              {profile?.title ? (
                <p className="text-sm text-muted-foreground">{profile.title}</p>
              ) : null}
              <p className="text-xs text-muted-foreground" dir="ltr">
                {formatPhoneDisplay(user.phone)}
              </p>
              {publicUrl ? (
                <Link
                  href={publicUrl as Route}
                  target="_blank"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
                  dir="ltr"
                >
                  {publicUrl}
                  <ExternalLinkIcon className="size-3" />
                </Link>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {!isSelf && user.role !== "admin" && !isBanned ? (
              <form action={adminStartImpersonationAction}>
                <input type="hidden" name="userId" value={user.id} />
                <Button size="sm" className="h-9">
                  <LogInIcon className="size-4" />
                  ورود به‌عنوان کاربر
                </Button>
              </form>
            ) : null}
            {publicUrl ? (
              <Link
                href={publicUrl as Route}
                target="_blank"
                className={cn(
                  buttonVariants({
                    size: "sm",
                    variant: "outline",
                    className: "h-9",
                  }),
                )}
              >
                <ExternalLinkIcon className="size-4" />
                مشاهده پروفایل
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <MetricBox icon={Link2Icon} label="لینک" value={links.length} />
          <MetricBox
            icon={CalendarDaysIcon}
            label="ثبت‌نام رویداد"
            value={registrations.length}
          />
          <MetricBox
            icon={UserIcon}
            label="عضویت"
            value={formatPersianDate(user.createdAt)}
            valueAsText
          />
        </div>
      </section>

      {/* User pages — directory of every page owned by this user, with
          quick links to the per-page billing/subscription workshop. */}
      {pagePlans.length > 0 ? (
        <section className="rounded-4xl bg-card p-5 border border-border">
          <header className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-base font-bold">صفحه‌های این کاربر</h3>
            <span className="text-xs text-muted-foreground">
              {toPersianDigits(pagePlans.length)} صفحه
            </span>
          </header>
          <ul className="grid gap-2">
            {pagePlans.map((p) => (
              <li
                key={p.pageId}
                className="flex flex-col gap-3 rounded-3xl border border-border bg-background/70 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/${p.slug}` as Route}
                      target="_blank"
                      className="inline-flex items-center gap-1 font-mono text-sm font-semibold text-primary"
                      dir="ltr"
                    >
                      /{p.slug}
                      <ExternalLinkIcon className="size-3" />
                    </Link>
                    <Badge
                      className={cn(
                        "rounded-full",
                        p.planKey === "business"
                          ? "bg-violet-500/12 text-violet-700"
                          : p.planKey === "pro"
                            ? "bg-emerald-500/12 text-emerald-700"
                            : "bg-muted text-muted-foreground",
                      )}
                    >
                      {p.planNameFa}
                    </Badge>
                    <Badge
                      className={cn(
                        "rounded-full",
                        p.status === "trialing"
                          ? "bg-amber-500/12 text-amber-700"
                          : p.status === "grace"
                            ? "bg-rose-500/12 text-rose-700"
                            : p.status === "expired" || p.status === "canceled"
                              ? "bg-muted text-muted-foreground"
                              : "bg-emerald-500/12 text-emerald-700",
                      )}
                    >
                      {p.status === "active"
                        ? "فعال"
                        : p.status === "trialing"
                          ? "آزمایشی"
                          : p.status === "pending_renewal"
                            ? "در انتظار تمدید"
                            : p.status === "grace"
                              ? "مهلت پرداخت"
                              : p.status === "expired"
                                ? "منقضی"
                                : "لغو شده"}
                    </Badge>
                    {p.cancelAtPeriodEnd ? (
                      <Badge className="rounded-full bg-muted text-[11px]">
                        لغو در پایان دوره
                      </Badge>
                    ) : null}
                  </div>
                  {p.fullName ? (
                    <p className="truncate text-xs text-muted-foreground">
                      {p.fullName}
                    </p>
                  ) : null}
                  {p.currentPeriodEnd ? (
                    <p className="text-[11px] text-muted-foreground">
                      پایان دوره: {formatPersianDate(p.currentPeriodEnd)}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/billing/invoices?userId=${user.id}` as Route}
                    className={cn(
                      buttonVariants({
                        size: "sm",
                        variant: "ghost",
                        className: "h-8 rounded-full text-xs",
                      }),
                    )}
                  >
                    فاکتورها
                  </Link>
                  <Link
                    href={`/admin/billing/pages/${p.pageId}` as Route}
                    className={cn(
                      buttonVariants({
                        size: "sm",
                        className: "h-8 rounded-full text-xs",
                      }),
                    )}
                  >
                    مدیریت پلن و دوره
                    <ExternalLinkIcon className="size-3" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
            تغییر پلن، اعطای قابلیت، تمدید دوره و فاکتورهای هر صفحه از داشبورد
            صفحه قابل دسترسی است.
          </p>
        </section>
      ) : null}

      {/* Edit basic info */}
      {profile ? (
        <section
          key={profile.id}
          className="rounded-4xl bg-card p-5 border border-border"
        >
          <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-bold">ویرایش اطلاعات پایه</h3>
            {pages.length > 1 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground">صفحه:</span>
                {pages.map((p) => (
                  <Link
                    key={p.id}
                    href={`/admin/users/${user.id}?pageId=${p.id}` as Route}
                    className={cn(
                      "rounded-full px-3 py-1 text-[11px] font-semibold",
                      p.id === profile.id
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground",
                    )}
                    dir="ltr"
                  >
                    /{p.slug}
                  </Link>
                ))}
              </div>
            ) : null}
          </header>
          <form
            action={adminUpdateUserProfileRedirectAction}
            className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          >
            <input type="hidden" name="userId" value={user.id} />
            <input type="hidden" name="pageId" value={profile.id} />
            <Field
              id="fullName"
              label="نام کامل"
              defaultValue={profile.fullName ?? ""}
              autoComplete="name"
              required
            />
            <Field
              id="title"
              label="عنوان شغلی"
              defaultValue={profile.title ?? ""}
              autoComplete="organization-title"
              required
            />
            <Field
              id="slug"
              label="شناسه عمومی"
              defaultValue={profile.slug}
              dir="ltr"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
            />
            <Field
              id="email"
              label="ایمیل"
              defaultValue={profile.email ?? ""}
              type="email"
              inputMode="email"
              autoComplete="email"
              dir="ltr"
            />
            <Field
              id="publicPhone"
              label="شماره عمومی"
              defaultValue={profile.publicPhone ?? ""}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
            />
            <div className="sm:col-span-2">
              <Label htmlFor="bio" className="mb-1.5 inline-block text-xs">
                بیو
              </Label>
              <Textarea
                id="bio"
                name="bio"
                defaultValue={profile.bio ?? ""}
                rows={4}
                maxLength={280}
              />
            </div>
            <div className="flex justify-end sm:col-span-2">
              <Button type="submit" size="default" className="h-10">
                ذخیره تغییرات
              </Button>
            </div>
          </form>
        </section>
      ) : (
        <section className="rounded-4xl border border-dashed border-border/70 bg-background/60 p-5 text-sm text-muted-foreground">
          این کاربر هنوز پروفایل نساخته است. ابتدا باید فرایند آن‌بوردینگ را
          تکمیل کند.
        </section>
      )}

      {/* Role */}
      {!isSelf ? (
        <section className="rounded-4xl bg-card p-5 border border-border">
          <h3 className="mb-2 text-base font-bold">نقش کاربر</h3>
          <p className="mb-4 text-xs text-muted-foreground">
            تغییر نقش به «ادمین» دسترسی کامل به پنل داخلی را می‌دهد. توجه: اگر
            شماره این کاربر در{" "}
            <code className="rounded bg-muted px-1">ADMIN_PHONE_NUMBERS</code>{" "}
            نباشد، در ورود بعدی به حالت کاربر عادی برمی‌گردد.
          </p>
          <form action={adminUpdateUserRoleAction} className="flex gap-2">
            <input type="hidden" name="userId" value={user.id} />
            {user.role === "admin" ? (
              <>
                <input type="hidden" name="role" value="user" />
                <Button size="sm" variant="outline" className="h-9">
                  تنزل به کاربر عادی
                </Button>
              </>
            ) : (
              <>
                <input type="hidden" name="role" value="admin" />
                <Button size="sm" className="h-9">
                  <ShieldCheckIcon className="size-4" />
                  ارتقا به ادمین
                </Button>
              </>
            )}
          </form>
        </section>
      ) : null}

      {/* Ban */}
      {!isSelf && user.role !== "admin" && !isBanned ? (
        <section className="rounded-4xl border border-rose-500/30 bg-rose-500/5 p-5">
          <h3 className="mb-2 text-base font-bold text-rose-700">
            مسدود کردن کاربر
          </h3>
          <p className="mb-3 text-xs leading-6 text-muted-foreground">
            با مسدود شدن، همه جلسات فعال ابطال می‌شوند و کاربر نمی‌تواند وارد
            شود. پروفایل عمومی همچنان قابل‌حذف است اما لاگین بسته می‌شود.
          </p>
          <BanUserForm userId={user.id} banAction={adminBanUserAction} />
        </section>
      ) : null}

      {/* Links */}
      {links.length ? (
        <section className="rounded-4xl bg-card p-5 border border-border">
          <h3 className="mb-3 text-base font-bold">لینک‌ها</h3>
          <ul className="grid gap-2">
            {links.map((link) => (
              <li
                key={link.id}
                className="flex items-center justify-between gap-3 rounded-3xl bg-background/70 p-3 border border-border"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {link.label}
                    {!link.isActive ? (
                      <span className="ms-2 text-[10px] text-muted-foreground">
                        (خاموش)
                      </span>
                    ) : null}
                  </p>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="block truncate text-xs text-primary"
                    dir="ltr"
                  >
                    {link.url}
                  </a>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Event history */}
      {registrations.length ? (
        <section className="rounded-4xl bg-card p-5 border border-border">
          <h3 className="mb-3 text-base font-bold">ثبت‌نام رویدادها</h3>
          <ul className="grid gap-2">
            {registrations.slice(0, 10).map((r) => (
              <li
                key={r.registrationId}
                className="flex items-center justify-between gap-3 rounded-3xl bg-background/70 p-3 border border-border text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">{r.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatPersianDateTime(r.startsAt)} ·{" "}
                    {r.status === "registered" ? "ثبت‌نام شده" : "لغو شده"}
                  </p>
                </div>
                <Link
                  href={`/admin/events/${r.eventId}` as Route}
                  className={cn(
                    buttonVariants({
                      size: "sm",
                      variant: "ghost",
                      className: "h-8 rounded-full text-xs",
                    }),
                  )}
                >
                  مشاهده رویداد
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Recent sessions */}
      {recentSessions.length ? (
        <section className="rounded-4xl bg-card p-5 border border-border">
          <h3 className="mb-3 text-base font-bold">آخرین جلسات</h3>
          <ul className="grid gap-2 text-xs">
            {recentSessions.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-3xl bg-background/70 p-3 border border-border"
              >
                <span className="font-semibold">
                  {formatPersianDateTime(s.createdAt)}
                </span>
                <span className="text-muted-foreground">
                  آخرین فعالیت: {formatPersianDateTime(s.lastSeenAt)}
                </span>
                {s.revokedAt ? (
                  <span className="text-rose-500">ابطال‌شده</span>
                ) : new Date(s.expiresAt) < new Date() ? (
                  <span className="text-muted-foreground">منقضی</span>
                ) : (
                  <span className="text-emerald-600">فعال</span>
                )}
                {s.ipAddress ? (
                  <span className="text-muted-foreground" dir="ltr">
                    {s.ipAddress}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Danger zone */}
      {!isSelf && user.role !== "admin" ? (
        <section className="rounded-4xl border border-rose-500/40 bg-rose-500/5 p-5">
          <div className="mb-3 flex items-center gap-2 text-rose-700">
            <AlertTriangleIcon className="size-4" />
            <h3 className="text-base font-bold">منطقه خطرناک</h3>
          </div>
          <p className="mb-3 text-xs leading-6 text-muted-foreground">
            حذف کاربر باعث پاک شدن دائمی پروفایل، لینک‌ها، ثبت‌نام‌ها و جلسات
            می‌شود. برای تایید، شماره کاربر را دقیقاً وارد کنید:{" "}
            <code dir="ltr" className="rounded bg-muted px-1">
              {user.phone}
            </code>
          </p>
          <form
            action={adminDeleteUserAction}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <input type="hidden" name="userId" value={user.id} />
            <Input
              name="confirmPhone"
              required
              placeholder="مثلاً +98912..."
              dir="ltr"
              autoComplete="off"
              className="sm:flex-1"
            />
            <Button
              type="submit"
              variant="outline"
              className="h-11 text-rose-700 hover:text-rose-700"
            >
              <Trash2Icon className="size-4" />
              حذف دائمی
            </Button>
          </form>
        </section>
      ) : null}

      <p className="text-[10px] text-muted-foreground">
        شناسه داخلی:{" "}
        <code dir="ltr" className="rounded bg-muted px-1">
          {user.id}
        </code>{" "}
        · آخرین ورود:{" "}
        {user.lastLoginAt ? formatPersianDateTime(user.lastLoginAt) : "—"} ·
        تعداد جلسات اخیر: {toPersianDigits(recentSessions.length)}
      </p>
    </div>
  );
}

function Flash({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "success" | "error";
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-3xl border p-3 text-sm",
        tone === "success"
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
          : "border-rose-500/30 bg-rose-500/10 text-rose-700",
      )}
    >
      {tone === "success" ? (
        <CheckCircle2Icon className="size-4" />
      ) : (
        <AlertTriangleIcon className="size-4" />
      )}
      {children}
    </div>
  );
}

function MetricBox({
  icon: Icon,
  label,
  value,
  valueAsText = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  valueAsText?: boolean;
}) {
  return (
    <div className="rounded-3xl bg-background/60 p-3 border border-border">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className="size-3" />
        {label}
      </div>
      <p className={cn("font-bold", valueAsText ? "text-sm" : "text-xl")}>
        {valueAsText ? value : toPersianDigits(value)}
      </p>
    </div>
  );
}

function Field({
  id,
  label,
  ...rest
}: {
  id: string;
  label: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1.5 inline-block text-xs">
        {label}
      </Label>
      <Input id={id} name={id} {...rest} />
    </div>
  );
}
