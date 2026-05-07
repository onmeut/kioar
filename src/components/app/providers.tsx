"use client";

import { DirectionProvider } from "@base-ui/react/direction-provider";

import { StandaloneZoomLock } from "@/components/app/standalone-zoom-lock";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <DirectionProvider direction="rtl">
      <TooltipProvider>
        <StandaloneZoomLock />
        {children}
        <Toaster
          // Desktop: bottom-right (shadcn/sonner default). Mobile: pinned to
          // the bottom edge above the mobile nav, full-width by sonner default.
          position="bottom-right"
          closeButton
          richColors
          dir="rtl"
          offset={16}
          mobileOffset={{
            bottom: "calc(5rem + env(safe-area-inset-bottom))",
            left: 16,
            right: 16,
          }}
          toastOptions={{
            className: "font-sans",
          }}
        />
      </TooltipProvider>
    </DirectionProvider>
  );
}
