"use client";

import { useState } from "react";

import { MockupPortalProvider } from "@/components/dashboard/mockup-portal-context";

/**
 * Phone-shaped frame that hosts the dashboard live-preview. The frame:
 *   - establishes a containing block (`transform: translateZ(0)`) so any
 *     `position: fixed` modal/overlay rendered inside is clipped to the phone
 *   - exposes its body as the portal container for `<Dialog>` / `<Sheet>` via
 *     `MockupPortalProvider` so booking/form modals open *inside* the mockup
 *   - scrolls vertically with a visible scrollbar (per design feedback —
 *     hiding the scrollbar made it unclear that more content existed)
 */
export function PhoneMockupFrame({ children }: { children: React.ReactNode }) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);

  return (
    <div
      className="relative flex w-85 flex-1 min-h-145 max-h-190 shrink-0 flex-col overflow-hidden rounded-[44px] border-2 border-foreground/15 bg-card shadow-2xl"
      // translateZ(0) makes this a containing block for fixed descendants —
      // required for in-mockup modal positioning. Tailwind's `transform-gpu`
      // would also work; explicit style avoids surprises if class purging
      // changes that utility's emitted CSS.
      style={{ transform: "translateZ(0)" }}
    >
      <div
        ref={setContainer}
        className="relative flex-1 overflow-y-auto touch-pan-y"
      >
        <MockupPortalProvider container={container}>
          {children}
        </MockupPortalProvider>
      </div>
    </div>
  );
}
