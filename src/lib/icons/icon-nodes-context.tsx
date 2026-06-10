"use client";

import { createContext, useContext } from "react";

import type { IconNodeMap } from "@/lib/icons/icon-node";

// Carries raw SVG nodes for icons rendered on a page that live OUTSIDE the
// curated static bundle. The public profile loader resolves these server-side
// (from the full Tabler catalog) and provides them here, keyed by the icon's
// kebab name (without the `t:` prefix). LinkIconBubble reads this to render
// such icons inline — so the public page can show any of the 5039 icons
// without importing the full icon module.
//
// Default is empty: surfaces that don't provide it (the editor, admin) simply
// fall back to the curated component or the placeholder, exactly as before.
const IconNodesContext = createContext<IconNodeMap>({});

export function IconNodesProvider({
  value,
  children,
}: {
  value: IconNodeMap;
  children: React.ReactNode;
}) {
  return (
    <IconNodesContext.Provider value={value}>
      {children}
    </IconNodesContext.Provider>
  );
}

export function useIconNodes(): IconNodeMap {
  return useContext(IconNodesContext);
}
