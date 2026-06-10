"use client";

import Image from "next/image";

import { formatPriceDisplay } from "@/lib/money";
import { toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";
import type {
  PublicProductBlockData,
  PublicProductItem,
} from "@/components/public/public-product-block";

export function PublicServicesPage({
  block,
}: {
  block: PublicProductBlockData;
}) {
  const items = block.items.filter((it) => it.availability !== "hidden");

  return (
    <div className="w-full px-4 pb-6 lg:px-8">
      {block.description ? (
        <p className="pt-4 pb-2 text-sm text-muted-foreground">{block.description}</p>
      ) : null}

      <ul className="mt-2 grid gap-3">
        {items.map((item) => (
          <ServiceCard
            key={item.id}
            item={item}
            currency={block.currency}
            showPrice={block.showPrices}
          />
        ))}
      </ul>
    </div>
  );
}

function ServiceCard({
  item,
  currency,
  showPrice,
}: {
  item: PublicProductItem;
  currency: PublicProductBlockData["currency"];
  showPrice: boolean;
}) {
  const soldOut = item.availability === "sold_out";
  const priceLabel = showPrice
    ? formatPriceDisplay(
        {
          priceType: item.priceType,
          priceAmount: item.priceAmount,
          priceAmountMax: item.priceAmountMax,
        },
        currency,
      )
    : "";

  return (
    <li
      className={cn(
        "rounded-2xl border border-border bg-muted/20 p-4",
        soldOut && "opacity-50",
      )}
    >
      <div className="flex items-start gap-3">
        {item.imageUrl ? (
          <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-muted">
            <Image
              src={item.imageUrl}
              alt={item.title}
              fill
              className="object-cover"
              sizes="56px"
            />
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold">{item.title}</p>
            {item.isFeatured && !soldOut ? (
              <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                پیشنهاد ما
              </span>
            ) : null}
          </div>
          {item.badge ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{item.badge}</p>
          ) : null}
          {item.description ? (
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              {item.description}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <span dir="ltr" className="text-base font-bold tabular-nums">
          {soldOut ? (
            <span className="text-sm font-medium text-muted-foreground">
              ناموجود
            </span>
          ) : priceLabel ? (
            toPersianDigits(priceLabel)
          ) : (
            <span className="text-sm font-medium text-muted-foreground">
              تماس بگیرید
            </span>
          )}
        </span>

        {item.externalUrl && !soldOut ? (
          <a
            href={item.externalUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center rounded-full border border-border bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-muted tap-target"
          >
            اطلاعات بیشتر
          </a>
        ) : null}
      </div>
    </li>
  );
}
