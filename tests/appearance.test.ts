import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { pageAppearanceSchema } from "@/lib/appearance/schema";
import {
  coerceAppearance,
  DEFAULT_APPEARANCE,
} from "@/lib/appearance/types";
import {
  effectFilter,
  gradientCss,
  tintOverlayStyle,
  wallpaperLayerStyle,
} from "@/lib/appearance/wallpaper";
import {
  gradientFromBase,
  hexToHsl,
  SUGGESTED_BASE_COLORS,
  SUGGESTED_GRADIENT_BASES,
} from "@/lib/appearance/color";

describe("appearance: wallpaper CSS helpers", () => {
  it("gradientCss: linear-down emits 180deg top→bottom", () => {
    const css = gradientCss("#fff", "#000", "linear-down");
    assert.equal(css, "linear-gradient(180deg, #fff 0%, #000 100%)");
  });

  it("gradientCss: linear-up emits 0deg bottom→top", () => {
    const css = gradientCss("#abc", "#def", "linear-up");
    assert.equal(css, "linear-gradient(0deg, #abc 0%, #def 100%)");
  });

  it("gradientCss: radial centered upper", () => {
    const css = gradientCss("red", "blue", "radial");
    assert.equal(css, "radial-gradient(circle at 50% 30%, red 0%, blue 100%)");
  });

  it("effectFilter: returns the right CSS filter per effect", () => {
    assert.equal(effectFilter("none"), undefined);
    assert.equal(effectFilter("mono"), "grayscale(1)");
    assert.equal(effectFilter("blur"), "blur(8px)");
    assert.equal(effectFilter("halftone"), "url(#kioar-halftone)");
  });

  it("wallpaperLayerStyle: fill returns backgroundColor only", () => {
    const s = wallpaperLayerStyle({ type: "fill", color: "#fafafa" });
    assert.equal(s.backgroundColor, "#fafafa");
    assert.equal(s.backgroundImage, undefined);
  });

  it("wallpaperLayerStyle: gradient + noise stacks SVG noise on top", () => {
    const s = wallpaperLayerStyle({
      type: "gradient",
      from: "#000",
      to: "#fff",
      direction: "linear-down",
      noise: true,
    });
    assert.ok(s.backgroundImage?.toString().includes("data:image/svg+xml"));
    assert.ok(s.backgroundImage?.toString().includes("linear-gradient"));
  });

  it("wallpaperLayerStyle: image carries url + filter for halftone", () => {
    const s = wallpaperLayerStyle({
      type: "image",
      imageUrl: "https://example.com/x.jpg",
      effect: "halftone",
      tint: 0,
    });
    assert.ok(s.backgroundImage?.toString().includes("https://example.com/x.jpg"));
    assert.equal(s.filter, "url(#kioar-halftone)");
  });

  it("tintOverlayStyle: zero tint returns null", () => {
    const s = tintOverlayStyle({
      type: "image",
      imageUrl: "/x.jpg",
      effect: "none",
      tint: 0,
    });
    assert.equal(s, null);
  });

  it("tintOverlayStyle: 50 → rgba black at 0.5", () => {
    const s = tintOverlayStyle({
      type: "image",
      imageUrl: "/x.jpg",
      effect: "none",
      tint: 50,
    });
    assert.equal(s?.backgroundColor, "rgba(0, 0, 0, 0.500)");
  });

  it("tintOverlayStyle: never returns overlay for non-image wallpapers", () => {
    assert.equal(
      tintOverlayStyle({ type: "fill", color: "#fff" }),
      null,
    );
    assert.equal(
      tintOverlayStyle({
        type: "gradient",
        from: "#fff",
        to: "#000",
        direction: "radial",
      }),
      null,
    );
  });
});

describe("appearance: zod schema", () => {
  it("accepts DEFAULT_APPEARANCE", () => {
    const r = pageAppearanceSchema.safeParse(DEFAULT_APPEARANCE);
    assert.equal(r.success, true);
  });

  it("accepts a full image-wallpaper appearance", () => {
    const r = pageAppearanceSchema.safeParse({
      version: 1,
      theme: "ocean",
      wallpaper: {
        type: "image",
        imageUrl: "https://cdn.kioar.com/uploads/x.jpg",
        effect: "halftone",
        tint: 35,
      },
    });
    assert.equal(r.success, true);
  });

  it("rejects unknown theme id", () => {
    const r = pageAppearanceSchema.safeParse({
      version: 1,
      theme: "fuchsia",
      wallpaper: { type: "fill", color: "#fff" },
    });
    assert.equal(r.success, false);
  });

  it("rejects gradient missing 'to' color", () => {
    const r = pageAppearanceSchema.safeParse({
      version: 1,
      theme: "light",
      wallpaper: {
        type: "gradient",
        from: "#fff",
        direction: "linear-down",
      },
    });
    assert.equal(r.success, false);
  });

  it("rejects tint outside 0–100", () => {
    const r = pageAppearanceSchema.safeParse({
      version: 1,
      theme: "light",
      wallpaper: {
        type: "image",
        imageUrl: "/x.jpg",
        effect: "none",
        tint: 250,
      },
    });
    assert.equal(r.success, false);
  });

  it("rejects javascript: as imageUrl (no protocol injection)", () => {
    const r = pageAppearanceSchema.safeParse({
      version: 1,
      theme: "light",
      wallpaper: {
        type: "image",
        imageUrl: "javascript:alert(1)",
        effect: "none",
        tint: 0,
      },
    });
    assert.equal(r.success, false);
  });

  it("rejects color with stray junk", () => {
    const r = pageAppearanceSchema.safeParse({
      version: 1,
      theme: "light",
      wallpaper: { type: "fill", color: "url(http://evil)" },
    });
    assert.equal(r.success, false);
  });

  it("accepts var(--…) tokens as color", () => {
    const r = pageAppearanceSchema.safeParse({
      version: 1,
      theme: "light",
      wallpaper: { type: "fill", color: "var(--background)" },
    });
    assert.equal(r.success, true);
  });
});

describe("appearance: gradient + suggested swatches", () => {
  it("SUGGESTED_BASE_COLORS lists the 8 named hues", () => {
    assert.equal(SUGGESTED_BASE_COLORS.length, 8);
    const names = SUGGESTED_BASE_COLORS.map((s) => s.nameFa);
    for (const expected of [
      "آتش",
      "نارنج",
      "آفتاب",
      "جنگل",
      "اقیانوس",
      "ارغوان",
      "شکوفه",
      "شکلات",
    ]) {
      assert.ok(names.includes(expected), `expected ${expected}`);
    }
  });

  it("SUGGESTED_GRADIENT_BASES adds مشکی + سفید on top of the base 8", () => {
    assert.equal(SUGGESTED_GRADIENT_BASES.length, 10);
    const names = SUGGESTED_GRADIENT_BASES.map((s) => s.nameFa);
    assert.ok(names.includes("مشکی"));
    assert.ok(names.includes("سفید"));
  });

  it("gradientFromBase: red base → two distinct hex shades sharing the same hue", () => {
    const { from, to } = gradientFromBase("#ef4444");
    assert.notEqual(from, to);
    assert.ok(/^#[0-9a-f]{6}$/.test(from));
    assert.ok(/^#[0-9a-f]{6}$/.test(to));
    // Both ends should be within ~15° of the base hue so the gradient
    // reads as a single colour family.
    const [hBase] = hexToHsl("#ef4444");
    const [hFrom] = hexToHsl(from);
    const [hTo] = hexToHsl(to);
    assert.ok(Math.abs(hBase - hFrom) < 15);
    assert.ok(Math.abs(hBase - hTo) < 15);
  });

  it("gradientFromBase: greyscale base picks a slate-style soft gradient", () => {
    const { from, to } = gradientFromBase("#888888");
    assert.notEqual(from, to);
  });

  it("gradientFromBase: white base lifts the top end to pure white", () => {
    const { from } = gradientFromBase("#ffffff");
    assert.equal(from, "#ffffff");
  });

  it("gradientFromBase: black base drops the bottom end to pure black", () => {
    const { to } = gradientFromBase("#000000");
    assert.equal(to, "#000000");
  });
});

describe("appearance: coerceAppearance fallback", () => {
  it("null collapses to default", () => {
    assert.deepEqual(coerceAppearance(null), DEFAULT_APPEARANCE);
  });

  it("unknown version collapses to default", () => {
    assert.deepEqual(
      coerceAppearance({ version: 99, theme: "dark", wallpaper: {} }),
      DEFAULT_APPEARANCE,
    );
  });

  it("valid v1 blob passes through untouched", () => {
    const input = {
      version: 1 as const,
      theme: "rose" as const,
      wallpaper: { type: "fill" as const, color: "#fff" },
    };
    assert.deepEqual(coerceAppearance(input), input);
  });
});
