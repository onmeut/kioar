"use client";

import { BriefcaseIcon, ShoppingBagIcon, TagIcon, UtensilsCrossedIcon } from "lucide-react";

import { BlockCard } from "@/components/dashboard/block-card";
import { SpotlightStarButton } from "@/components/dashboard/spotlight-star-button";
import { LinkIconBubble } from "@/components/dashboard/link-icon-picker";
import type { RequiredPlanTier } from "@/lib/block-features";
import { toPersianDigits } from "@/lib/persian";
import type {
  BlockAnimationStyle,
  BlockSpotlight,
} from "@/lib/block-spotlight";

import type { ProductBlockDraft } from "./product-builder-dialog";
import { PRESET_DEFAULT_ICON } from "./product-builder-dialog";
import type { ProductBlockPreset } from "@/lib/validations";

export type EditableProductBlockWithId = ProductBlockDraft & {
  id: string;
  isActive: boolean;
  sortOrder: number;
  spotlight: BlockSpotlight;
  animationStyle: BlockAnimationStyle | null;
};

export type ProductBlockRowProps = {
  block: EditableProductBlockWithId;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: (next: boolean) => void;
  dragProps?: React.HTMLAttributes<HTMLButtonElement>;
  isDragging?: boolean;
  /** Phase 5 — render in a read-only locked state when the page lacks
   * the `products_block` entitlement. With the default plan matrix this
   * is never true (every plan grants the boolean), but admins can revoke
   * it manually or move it to a higher tier from `/admin/plans`. */
  locked?: boolean;
  /** Lowest paid plan that currently grants `products_block`, sourced
   * from the live `plan_features` matrix. Drives lock chip colour. */
  lockedPlan?: RequiredPlanTier;
  pinAllowed?: boolean;
  animateAllowed?: boolean;
  onSpotlightChange?: (next: {
    spotlight: BlockSpotlight;
    animationStyle: BlockAnimationStyle | null;
  }) => Promise<void> | void;
};

function PresetFallbackIcon({ preset }: { preset: ProductBlockPreset | null }) {
  if (preset === "menu") {
    return (
      <span className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
        <UtensilsCrossedIcon className="size-5" />
      </span>
    );
  }
  if (preset === "services" || preset === "packages") {
    return (
      <span className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
        <BriefcaseIcon className="size-5" />
      </span>
    );
  }
  if (preset === "shop" || preset === "portfolio") {
    return (
      <span className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
        <ShoppingBagIcon className="size-5" />
      </span>
    );
  }
  return (
    <span className="grid size-10 place-items-center rounded-2xl bg-primary/10 text-primary">
      <TagIcon className="size-5" />
    </span>
  );
}

export function ProductBlockRow({
  block,
  onEdit,
  onDelete,
  onToggleActive,
  dragProps,
  isDragging,
  locked = false,
  lockedPlan = "pro",
  pinAllowed = false,
  animateAllowed = false,
  onSpotlightChange,
}: ProductBlockRowProps) {
  const itemCount = block.items.length;
  return (
    <BlockCard
      dragProps={dragProps}
      isDragging={isDragging}
      locked={locked}
      lockedPlan={lockedPlan}
      icon={(() => {
        const isPresetDefault =
          block.iconKey &&
          Object.values(PRESET_DEFAULT_ICON).includes(block.iconKey);
        const hasCustomIcon =
          (block.iconKey && !isPresetDefault) ||
          block.iconUrl ||
          block.imageUrl;
        return hasCustomIcon ? (
          <LinkIconBubble
            iconKey={block.iconKey}
            iconUrl={block.iconUrl}
            imageUrl={block.imageUrl}
            url=""
            size={40}
            className="rounded-2xl"
          />
        ) : (
          <PresetFallbackIcon preset={block.preset} />
        );
      })()}
      title={block.name || "محصولات"}
      meta={undefined}
      trailing={
        <span
          className="inline-flex items-center gap-1 rounded-xl bg-muted px-2 py-1 text-[11px] font-bold text-muted-foreground"
          title="تعداد موارد"
        >
          <TagIcon className="size-3" />
          <span className="mt-0.5">{toPersianDigits(itemCount)}</span>
        </span>
      }
      spotlightSlot={
        onSpotlightChange ? (
          <SpotlightStarButton
            blockKind="product"
            spotlight={block.spotlight}
            animationStyle={block.animationStyle}
            pinAllowed={pinAllowed}
            animateAllowed={animateAllowed}
            onChange={onSpotlightChange}
          />
        ) : null
      }
      isActive={block.isActive}
      onToggleActive={onToggleActive}
      onEdit={locked ? () => {} : onEdit}
      onDelete={onDelete}
      deleteTitle="حذف بلوک محصولات؟"
      deleteDescription="با حذف بلوک، تمام موارد آن حذف می‌شوند."
    />
  );
}
