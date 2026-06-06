/**
 * scripts/generate-card-batch.ts
 *
 * Mints a batch of physical NFC/QR cards and produces the print + NFC handoff
 * package. This is the pre-printing step (Phase 2.2).
 *
 * For each card it:
 *   1. Generates a collision-checked short base32 id (see src/lib/cards/card-id).
 *   2. INSERTs an `unassigned` `cards` row tagged with batch/color/material/source.
 *   3. Renders ONE SVG per card encoding `https://kioar.com/c/{id}` using the
 *      SAME QR engine as the in-app share QR (centered logo, styled modules).
 *      Error-correction is level H — it is forced inside `buildQrMatrix`, so
 *      the printed code matches the digital one and survives the logo punch-out
 *      plus physical wear.
 *   4. Writes `manifest.csv` (id, url, qr_filename, color, material, batch) —
 *      the same `url` is the NFC payload the vendor/in-house writes & locks.
 *
 * Output: `card-batches/batch-{batch}/qr/{ID}.svg` + `manifest.csv`.
 *
 * Usage:
 *   npm run cards:batch -- --count 500 --batch 2026-001 --color black \
 *     --material colorful --source purchased
 *
 * Flags:
 *   --count     N cards to mint (required, > 0)
 *   --batch     batch label, e.g. 2026-001 (required)
 *   --color     card color string (default "black")
 *   --material  colorful | metal (default colorful)
 *   --source    purchased | gift_pro | gift_business (default purchased)
 *   --out       output root dir (default ./card-batches)
 *
 * The card URL is HARDCODED to production (https://kioar.com) on purpose:
 * printed cards are permanent and must point to prod regardless of the env
 * this script runs in.
 */

import "dotenv/config";

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { drizzle } from "drizzle-orm/postgres-js";
import { inArray } from "drizzle-orm";
import postgres from "postgres";

import * as schema from "../src/db/schema";
import { renderQrSvg } from "../src/lib/qr/render-svg";
import { DEFAULT_QR_STYLE } from "../src/lib/qr/types";

// Permanent production base for printed/NFC URLs. Do NOT read from env.
const CARD_BASE_URL = "https://kioar.com";

const ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
const ID_LENGTH = 7;

type Material = "colorful" | "metal";
type Source = "purchased" | "gift_pro" | "gift_business";

function randomId(): string {
  const bytes = new Uint8Array(ID_LENGTH);
  // Node 19+ exposes Web Crypto on the global.
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < ID_LENGTH; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

function parseArgs(argv: string[]) {
  const args: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1];
      if (val && !val.startsWith("--")) {
        args[key] = val;
        i++;
      } else {
        args[key] = "true";
      }
    }
  }
  return args;
}

function cardUrl(id: string): string {
  return `${CARD_BASE_URL}/c/${id}`;
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

async function generateUniqueIds(
  db: ReturnType<typeof drizzle<typeof schema>>,
  count: number,
): Promise<string[]> {
  const result = new Set<string>();
  let attempts = 0;
  while (result.size < count && attempts < 50) {
    attempts++;
    const candidates = new Set<string>();
    while (candidates.size < count - result.size) {
      const id = randomId();
      if (!result.has(id)) candidates.add(id);
    }
    const list = [...candidates];
    const taken = await db
      .select({ id: schema.cards.id })
      .from(schema.cards)
      .where(inArray(schema.cards.id, list));
    const takenSet = new Set(taken.map((r) => r.id));
    for (const id of list) if (!takenSet.has(id)) result.add(id);
  }
  if (result.size < count) {
    throw new Error(`Could not mint ${count} unique ids after ${attempts} tries`);
  }
  return [...result];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const count = Number(args.count);
  const batch = args.batch;
  const color = args.color || "black";
  const material = (args.material || "colorful") as Material;
  const source = (args.source || "purchased") as Source;
  const outRoot = args.out || "card-batches";

  if (!Number.isInteger(count) || count <= 0) {
    throw new Error("--count must be a positive integer");
  }
  if (!batch) throw new Error("--batch is required (e.g. 2026-001)");
  if (material !== "colorful" && material !== "metal") {
    throw new Error("--material must be 'colorful' or 'metal'");
  }
  if (!["purchased", "gift_pro", "gift_business"].includes(source)) {
    throw new Error("--source must be purchased | gift_pro | gift_business");
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL not set — cannot mint cards.");

  const client = postgres(databaseUrl, { max: 1, prepare: false });
  const db = drizzle(client, { schema });

  try {
    console.log(`Minting ${count} cards for batch ${batch}…`);
    const ids = await generateUniqueIds(db, count);

    // Insert all rows in one statement.
    await db.insert(schema.cards).values(
      ids.map((id) => ({
        id,
        status: "unassigned" as const,
        batch,
        color,
        material,
        source,
      })),
    );
    console.log(`✅ Inserted ${ids.length} unassigned card rows.`);

    // Output dirs.
    const batchDir = join(outRoot, `batch-${batch}`);
    const qrDir = join(batchDir, "qr");
    mkdirSync(qrDir, { recursive: true });

    // White background so the SVG prints correctly on any stock.
    const style = { ...DEFAULT_QR_STYLE };
    const rows: string[] = ["id,url,qr_filename,nfc_url,color,material,batch"];

    for (const id of ids) {
      const url = cardUrl(id);
      const svg = renderQrSvg({ text: url, style, background: "#FFFFFF" });
      const qrFilename = `${id}.svg`;
      writeFileSync(join(qrDir, qrFilename), svg, "utf8");
      rows.push(
        [id, url, qrFilename, url, color, material, batch]
          .map(csvEscape)
          .join(","),
      );
    }

    const manifestPath = join(batchDir, "manifest.csv");
    writeFileSync(manifestPath, rows.join("\n") + "\n", "utf8");

    console.log(`✅ Wrote ${ids.length} QR SVGs → ${qrDir}`);
    console.log(`✅ Wrote manifest → ${manifestPath}`);
    console.log("");
    console.log("Handoff:");
    console.log("  • Send the qr/*.svg files + manifest.csv to the printer.");
    console.log(
      "  • NFC: encode each chip with its `nfc_url`, tap-test, THEN lock read-only.",
    );
  } finally {
    await client.end({ timeout: 5 });
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
