"use client";

import * as React from "react";
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { XIcon } from "lucide-react";
import { useMockupPortalContainer } from "@/components/dashboard/mockup-portal-context";

function Sheet({ ...props }: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({ container, ...props }: SheetPrimitive.Portal.Props) {
  // Same containment story as DialogPortal — when used inside the dashboard
  // live-preview phone mockup, the sheet renders into the phone frame.
  const mockupContainer = useMockupPortalContainer();
  return (
    <SheetPrimitive.Portal
      data-slot="sheet-portal"
      container={container ?? mockupContainer ?? undefined}
      {...props}
    />
  );
}

function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/30 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-sm",
        className,
      )}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: SheetPrimitive.Popup.Props & {
  side?: "top" | "right" | "bottom" | "left";
  showCloseButton?: boolean;
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          // Shared base — all sides
          "fixed z-50 flex flex-col bg-popover bg-clip-padding text-sm text-popover-foreground shadow-xl transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0",
          // Bottom sheet: anchored at bottom, capped at 90dvh so header always
          // stays on-screen. Callers can override with h-[Xdvh] or max-h-none.
          // NOTE: these are plain utility classes (not data-variants) so callers
          // can reliably override them via tailwind-merge without specificity issues.
          side === "bottom" &&
            "inset-x-0 bottom-0 max-h-[90dvh] overflow-hidden border-t data-ending-style:translate-y-10 data-starting-style:translate-y-10",
          side === "top" &&
            "inset-x-0 top-0 h-auto border-b data-ending-style:-translate-y-10 data-starting-style:-translate-y-10",
          side === "left" &&
            "inset-y-0 left-0 h-full w-3/4 border-e sm:max-w-sm data-ending-style:-translate-x-10 rtl:data-ending-style:translate-x-10 data-starting-style:-translate-x-10 rtl:data-starting-style:translate-x-10",
          side === "right" &&
            "inset-y-0 right-0 h-full w-3/4 border-s sm:max-w-sm data-ending-style:translate-x-10 rtl:data-ending-style:-translate-x-10 data-starting-style:translate-x-10 rtl:data-starting-style:-translate-x-10",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close
            data-slot="sheet-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-4 inset-e-4 bg-secondary"
                size="icon-sm"
              />
            }
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Popup>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex shrink-0 flex-col gap-1.5 p-6", className)}
      {...props}
    />
  );
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-6", className)}
      {...props}
    />
  );
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        "font-heading text-base font-semibold text-foreground",
        className,
      )}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
