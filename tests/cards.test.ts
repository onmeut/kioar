import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import QRCode from "qrcode";

import { buildQrMatrix } from "@/lib/qr/matrix";
import { renderQrSvg } from "@/lib/qr/render-svg";
import { DEFAULT_QR_STYLE } from "@/lib/qr/types";
import { isValidCardId } from "@/lib/cards/card-id";
import { transliterateName } from "@/lib/cards/transliterate";
import { citiesForProvince, isValidProvince, PROVINCE_NAMES } from "@/lib/cards/iran-geo";

const CARD_BASE_URL = "https://kioar.com";
const cardUrl = (id: string) => `${CARD_BASE_URL}/c/${id}`;

describe("cards: id validation", () => {
  it("accepts a well-formed 7-char base32 id", () => {
    assert.equal(isValidCardId("5MVMNB8"), true);
    assert.equal(isValidCardId("JYPE8YK"), true);
  });

  it("rejects ambiguous glyphs (0/O/1/I/L/U)", () => {
    assert.equal(isValidCardId("0MVMNB8"), false);
    assert.equal(isValidCardId("OMVMNB8"), false);
    assert.equal(isValidCardId("1MVMNB8"), false);
    assert.equal(isValidCardId("IMVMNB8"), false);
    assert.equal(isValidCardId("LMVMNB8"), false);
    assert.equal(isValidCardId("UMVMNB8"), false);
  });

  it("rejects wrong length and lowercase", () => {
    assert.equal(isValidCardId("ABC"), false);
    assert.equal(isValidCardId("ABCDEFGH"), false);
    assert.equal(isValidCardId("5mvmnb8"), false);
  });
});

describe("cards: printed QR encodes the canonical card URL at ECC H", () => {
  // The printed card QR must be byte-for-byte the canonical level-H encode of
  // `https://kioar.com/c/{id}` — otherwise a scanner could read a different URL
  // or fail behind the centered logo. This guards the print pipeline.
  for (const id of ["5MVMNB8", "JYPE8YK", "VKBFCP2", "ABCDEFG"]) {
    it(`matches canonical encode for ${id}`, () => {
      const url = cardUrl(id);
      const built = buildQrMatrix(url);
      const ref = QRCode.create(url, { errorCorrectionLevel: "H" });
      assert.equal(built.size, ref.modules.size, "matrix size differs");
      let mismatch = 0;
      for (let r = 0; r < built.size; r++) {
        for (let c = 0; c < built.size; c++) {
          const a = built.modules[r][c] ? 1 : 0;
          const b = ref.modules.data[r * built.size + c] === 1 ? 1 : 0;
          if (a !== b) mismatch++;
        }
      }
      assert.equal(mismatch, 0, "QR matrix is not the canonical ECC-H encode");
    });
  }

  it("renders a valid standalone SVG with quiet zone and white bg", () => {
    const url = cardUrl("5MVMNB8");
    const svg = renderQrSvg({
      text: url,
      style: DEFAULT_QR_STYLE,
      background: "#FFFFFF",
    });
    assert.match(svg, /^<svg /);
    assert.match(svg, /viewBox="0 0 \d+ \d+"/);
    assert.match(svg, /fill="#FFFFFF"/);
    // Quiet zone of 2 modules on each side → total = size + 4.
    const m = buildQrMatrix(url);
    assert.match(svg, new RegExp(`viewBox="0 0 ${m.size + 4} ${m.size + 4}"`));
  });
});

describe("cards: Persian → Latin transliteration (name on card)", () => {
  it("romanizes a common Persian name", () => {
    // Best-effort phonetic; exact spelling isn't asserted, just Latin output.
    const out = transliterateName("علی رضایی");
    assert.match(out, /^[A-Za-z ]+$/);
    assert.ok(out.length > 0);
  });

  it("title-cases and passes through Latin input", () => {
    assert.equal(transliterateName("john doe"), "John Doe");
  });

  it("returns empty for empty/nullish input", () => {
    assert.equal(transliterateName(""), "");
    assert.equal(transliterateName(null), "");
    assert.equal(transliterateName(undefined), "");
  });

  it("caps length at 40 chars", () => {
    const long = "a".repeat(100);
    assert.ok(transliterateName(long).length <= 40);
  });
});

describe("cards: Iran geo data", () => {
  it("covers all 31 provinces", () => {
    assert.equal(PROVINCE_NAMES.length, 31);
  });

  it("validates known provinces and rejects unknown", () => {
    assert.equal(isValidProvince("تهران"), true);
    assert.equal(isValidProvince("Atlantis"), false);
  });

  it("returns cities for a known province and [] for unknown", () => {
    assert.ok(citiesForProvince("تهران").includes("تهران"));
    assert.deepEqual(citiesForProvince("Atlantis"), []);
  });
});
