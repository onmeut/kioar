import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SEED_PATH = resolve(
  __dirname,
  "..",
  "scripts",
  "data",
  "categories-seed.json",
);

type Industry = {
  slug: string;
  titleFa: string;
  titleEn: string;
  iconKey: string;
  accountTypes: string[];
  sortOrder: number;
  isActive: boolean;
};

type Category = {
  industrySlug: string;
  slug: string;
  titleFa: string;
  titleEn: string;
  iconKey: string;
  accountType: string;
  sortOrder: number;
  isActive: boolean;
};

type Seed = {
  industries: Industry[];
  categories: Category[];
};

const seed = JSON.parse(readFileSync(SEED_PATH, "utf8")) as Seed;

describe("discover seed JSON", () => {
  it("has at least one industry and one category", () => {
    assert.ok(seed.industries.length >= 1);
    assert.ok(seed.categories.length >= 1);
  });

  it("industry slugs are unique", () => {
    const slugs = seed.industries.map((i) => i.slug);
    assert.equal(new Set(slugs).size, slugs.length);
  });

  it("category slugs are unique", () => {
    const slugs = seed.categories.map((c) => c.slug);
    assert.equal(new Set(slugs).size, slugs.length);
  });

  it("every industry has at least one account type from {personal, business}", () => {
    for (const ind of seed.industries) {
      assert.ok(
        Array.isArray(ind.accountTypes) && ind.accountTypes.length > 0,
        `industry ${ind.slug} missing accountTypes`,
      );
      for (const t of ind.accountTypes) {
        assert.ok(
          t === "personal" || t === "business",
          `industry ${ind.slug} has invalid account type "${t}"`,
        );
      }
    }
  });

  it("every category references an existing industry", () => {
    const indBySlug = new Map(seed.industries.map((i) => [i.slug, i]));
    for (const cat of seed.categories) {
      const ind = indBySlug.get(cat.industrySlug);
      assert.ok(
        ind,
        `category ${cat.slug} references unknown industry ${cat.industrySlug}`,
      );
    }
  });

  it("category.accountType is included in its industry's accountTypes", () => {
    const indBySlug = new Map(seed.industries.map((i) => [i.slug, i]));
    for (const cat of seed.categories) {
      const ind = indBySlug.get(cat.industrySlug)!;
      assert.ok(
        cat.accountType === "personal" || cat.accountType === "business",
        `category ${cat.slug} has invalid accountType "${cat.accountType}"`,
      );
      assert.ok(
        ind.accountTypes.includes(cat.accountType),
        `category ${cat.slug} accountType "${cat.accountType}" not in industry ${ind.slug} accountTypes [${ind.accountTypes.join(", ")}]`,
      );
    }
  });

  it("every industry and category has a Persian title", () => {
    for (const ind of seed.industries) {
      assert.ok(
        typeof ind.titleFa === "string" && ind.titleFa.trim().length > 0,
        `industry ${ind.slug} missing titleFa`,
      );
    }
    for (const cat of seed.categories) {
      assert.ok(
        typeof cat.titleFa === "string" && cat.titleFa.trim().length > 0,
        `category ${cat.slug} missing titleFa`,
      );
    }
  });

  it("every iconKey is a non-empty string", () => {
    for (const ind of seed.industries) {
      assert.ok(
        typeof ind.iconKey === "string" && ind.iconKey.length > 0,
        `industry ${ind.slug} missing iconKey`,
      );
    }
    for (const cat of seed.categories) {
      assert.ok(
        typeof cat.iconKey === "string" && cat.iconKey.length > 0,
        `category ${cat.slug} missing iconKey`,
      );
    }
  });

  it("slugs are kebab-case ASCII", () => {
    const re = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    for (const ind of seed.industries) {
      assert.match(ind.slug, re, `industry slug "${ind.slug}" not kebab-case`);
    }
    for (const cat of seed.categories) {
      assert.match(cat.slug, re, `category slug "${cat.slug}" not kebab-case`);
    }
  });

  it("category sort order is unique within each industry", () => {
    const byIndustry = new Map<string, number[]>();
    for (const cat of seed.categories) {
      const arr = byIndustry.get(cat.industrySlug) ?? [];
      arr.push(cat.sortOrder);
      byIndustry.set(cat.industrySlug, arr);
    }
    for (const [indSlug, orders] of byIndustry) {
      assert.equal(
        new Set(orders).size,
        orders.length,
        `industry ${indSlug} has duplicate category sortOrder values`,
      );
    }
  });

  it("industry sort order is unique", () => {
    const orders = seed.industries.map((i) => i.sortOrder);
    assert.equal(new Set(orders).size, orders.length);
  });
});
