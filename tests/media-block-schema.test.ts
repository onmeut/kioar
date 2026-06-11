import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { mediaBlockInputSchema } from "@/lib/validations";

function item(kind: "image" | "video" | "file", over = {}) {
  return {
    kind,
    url: "/uploads/media/x.webp",
    byteSize: 100,
    ...over,
  };
}

describe("mediaBlockInputSchema — photos mode", () => {
  it("accepts multiple image items", () => {
    const r = mediaBlockInputSchema.safeParse({
      mode: "photos",
      items: [item("image"), item("image")],
    });
    assert.equal(r.success, true);
  });

  it("rejects a video item in a photos block", () => {
    const r = mediaBlockInputSchema.safeParse({
      mode: "photos",
      items: [item("image"), item("video")],
    });
    assert.equal(r.success, false);
  });

  it("rejects a videoUrl on a photos block", () => {
    const r = mediaBlockInputSchema.safeParse({
      mode: "photos",
      videoUrl: "https://youtu.be/dQw4w9WgXcQ",
      items: [item("image")],
    });
    assert.equal(r.success, false);
  });
});

describe("mediaBlockInputSchema — video mode", () => {
  it("accepts a single uploaded video item", () => {
    const r = mediaBlockInputSchema.safeParse({
      mode: "video",
      items: [item("video", { url: "/uploads/media/x.mp4" })],
    });
    assert.equal(r.success, true);
  });

  it("accepts a pasted embed URL with no items", () => {
    const r = mediaBlockInputSchema.safeParse({
      mode: "video",
      videoUrl: "https://aparat.com/v/abc12",
      items: [],
    });
    assert.equal(r.success, true);
  });

  it("rejects both an embed URL and an uploaded video", () => {
    const r = mediaBlockInputSchema.safeParse({
      mode: "video",
      videoUrl: "https://youtu.be/dQw4w9WgXcQ",
      items: [item("video", { url: "/uploads/media/x.mp4" })],
    });
    assert.equal(r.success, false);
  });

  it("rejects more than one video item", () => {
    const r = mediaBlockInputSchema.safeParse({
      mode: "video",
      items: [
        item("video", { url: "/uploads/media/a.mp4" }),
        item("video", { url: "/uploads/media/b.mp4" }),
      ],
    });
    assert.equal(r.success, false);
  });

  it("allows an empty draft (not yet populated)", () => {
    const r = mediaBlockInputSchema.safeParse({ mode: "video", items: [] });
    assert.equal(r.success, true);
  });
});

describe("mediaBlockInputSchema — file mode", () => {
  it("accepts a single file item with a display name", () => {
    const r = mediaBlockInputSchema.safeParse({
      mode: "file",
      items: [
        item("file", { url: "/uploads/media/menu.pdf", displayName: "منو" }),
      ],
    });
    assert.equal(r.success, true);
    if (r.success) {
      assert.equal(r.data.items[0]?.displayName, "منو");
    }
  });

  it("rejects more than one file", () => {
    const r = mediaBlockInputSchema.safeParse({
      mode: "file",
      items: [
        item("file", { url: "/uploads/media/a.pdf" }),
        item("file", { url: "/uploads/media/b.pdf" }),
      ],
    });
    assert.equal(r.success, false);
  });

  it("rejects an image item in a file block", () => {
    const r = mediaBlockInputSchema.safeParse({
      mode: "file",
      items: [item("image")],
    });
    assert.equal(r.success, false);
  });
});

describe("mediaBlockInputSchema — item url", () => {
  it("accepts absolute https and root-relative urls", () => {
    assert.equal(
      mediaBlockInputSchema.safeParse({
        mode: "photos",
        items: [item("image", { url: "https://cdn.example.com/a.webp" })],
      }).success,
      true,
    );
    assert.equal(
      mediaBlockInputSchema.safeParse({
        mode: "photos",
        items: [item("image", { url: "/uploads/media/a.webp" })],
      }).success,
      true,
    );
  });

  it("rejects a non-url string", () => {
    const r = mediaBlockInputSchema.safeParse({
      mode: "photos",
      items: [item("image", { url: "javascript:alert(1)" })],
    });
    assert.equal(r.success, false);
  });
});
