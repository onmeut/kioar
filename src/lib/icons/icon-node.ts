// Client-safe shared types for raw Tabler icon SVG data. Kept separate from
// tabler-catalog.server.ts so client components can import the TYPE without
// pulling in the server-only fs catalog.

/** A single SVG element node: [tagName, attributes]. */
export type IconNode = [string, Record<string, string | number>];

/** Map of kebab-case icon name → its SVG path nodes. Embedded into public page
 * props for icons used on the page that live outside the curated bundle. */
export type IconNodeMap = Record<string, IconNode[]>;
