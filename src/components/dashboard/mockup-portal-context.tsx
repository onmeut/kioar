"use client";

import { createContext, useContext } from "react";

/**
 * Provides a portal container element so that Dialog/Sheet popups rendered
 * inside the dashboard live preview ("phone mockup") portal *into* the phone
 * frame instead of into `document.body`.
 *
 * The phone frame must establish a containing block for `position: fixed`
 * children (e.g. via `transform: translateZ(0)`) so the modal overlays cover
 * only the phone, not the whole viewport.
 */
const MockupPortalContext = createContext<HTMLElement | null>(null);

export function MockupPortalProvider({
  container,
  children,
}: {
  container: HTMLElement | null;
  children: React.ReactNode;
}) {
  return (
    <MockupPortalContext.Provider value={container}>
      {children}
    </MockupPortalContext.Provider>
  );
}

export function useMockupPortalContainer(): HTMLElement | null {
  return useContext(MockupPortalContext);
}

/**
 * True when the calling component is rendered inside the dashboard
 * live-preview phone mockup. Modals use this to switch to "fullscreen
 * mobile" layout regardless of the host viewport — the mockup always
 * presents a phone-sized canvas.
 */
export function useIsInMockup(): boolean {
  return useContext(MockupPortalContext) !== null;
}
