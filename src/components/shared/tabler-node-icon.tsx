import type { SVGProps } from "react";

import type { IconNode } from "@/lib/icons/icon-node";

/**
 * Renders a Tabler outline icon from its raw SVG path nodes — no React-component
 * import, no full-pack bundle. Uses the standard Tabler outline wrapper
 * (24×24 viewBox, currentColor stroke, width 2, round caps/joins) so it sits
 * visually identical to the statically-imported curated icons.
 *
 * Used for (a) the picker's full-catalog search results and (b) rendering a
 * saved icon whose component isn't in the curated bundle (nodes embedded into
 * page props server-side).
 */
export function TablerNodeIcon({
  nodes,
  size = 24,
  ...props
}: {
  nodes: IconNode[];
  size?: number | string;
} & Omit<SVGProps<SVGSVGElement>, "viewBox" | "width" | "height">) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {nodes.map(([tag, attrs], i) => {
        if (tag === "path") {
          return <path key={i} {...(attrs as SVGProps<SVGPathElement>)} />;
        }
        // Tabler outline icons are path-only, but stay defensive.
        return null;
      })}
    </svg>
  );
}
