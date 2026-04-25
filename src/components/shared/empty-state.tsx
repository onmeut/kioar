import type { Route } from "next";
import Link from "next/link";
import { LucideIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  cta,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  cta?: {
    href: Route;
    label: string;
  };
}) {
  return (
    <div className="surface-card flex flex-col items-center justify-center gap-3 p-6 text-center sm:p-8">
      <div className="flex size-14 items-center justify-center rounded-4xl bg-primary/10 text-primary">
        <Icon className="size-6" />
      </div>
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="max-w-md text-sm leading-7 text-muted-foreground">
        {description}
      </p>
      {cta ? (
        <Link
          href={cta.href}
          className={cn(
            buttonVariants({
              size: "lg",
              className: "rounded-full",
            }),
          )}
        >
          {cta.label}
        </Link>
      ) : null}
    </div>
  );
}
