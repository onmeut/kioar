import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  isSupportedVideoUrl,
  parseVideoEmbed,
} from "@/lib/media-embed";

describe("parseVideoEmbed — YouTube", () => {
  it("parses a standard watch URL", () => {
    const e = parseVideoEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    assert.equal(e?.provider, "youtube");
    assert.equal(e?.id, "dQw4w9WgXcQ");
    assert.equal(e?.embedUrl, "https://www.youtube.com/embed/dQw4w9WgXcQ");
  });

  it("parses a youtu.be short URL", () => {
    const e = parseVideoEmbed("https://youtu.be/dQw4w9WgXcQ");
    assert.equal(e?.id, "dQw4w9WgXcQ");
  });

  it("parses a /shorts/ URL", () => {
    const e = parseVideoEmbed("https://youtube.com/shorts/dQw4w9WgXcQ");
    assert.equal(e?.id, "dQw4w9WgXcQ");
  });

  it("tolerates a missing scheme", () => {
    const e = parseVideoEmbed("www.youtube.com/watch?v=dQw4w9WgXcQ");
    assert.equal(e?.id, "dQw4w9WgXcQ");
  });

  it("rejects a malformed video id", () => {
    assert.equal(parseVideoEmbed("https://youtube.com/watch?v=tooShort"), null);
  });
});

describe("parseVideoEmbed — Aparat", () => {
  it("parses a /v/ URL", () => {
    const e = parseVideoEmbed("https://www.aparat.com/v/AbC12");
    assert.equal(e?.provider, "aparat");
    assert.equal(e?.id, "AbC12");
    assert.ok(e?.embedUrl.includes("AbC12"));
  });

  it("parses an /embed/ URL", () => {
    const e = parseVideoEmbed("https://aparat.com/embed/xyz99");
    assert.equal(e?.id, "xyz99");
  });
});

describe("parseVideoEmbed — rejection", () => {
  it("rejects unsupported hosts", () => {
    assert.equal(parseVideoEmbed("https://vimeo.com/12345"), null);
    assert.equal(parseVideoEmbed("https://evil.example.com/v/abc"), null);
  });

  it("rejects junk input", () => {
    assert.equal(parseVideoEmbed(""), null);
    assert.equal(parseVideoEmbed("not a url"), null);
  });

  it("isSupportedVideoUrl mirrors parseVideoEmbed", () => {
    assert.equal(
      isSupportedVideoUrl("https://youtu.be/dQw4w9WgXcQ"),
      true,
    );
    assert.equal(isSupportedVideoUrl("https://vimeo.com/12345"), false);
  });
});
