import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  TABLER_ICONS,
  TABLER_ICON_GROUPS,
} from "@/lib/link-icons-tabler";

// TABLER_ICON_GROUPS lifts the section comments inside TABLER_ICONS into a
// machine-readable structure that drives the icon picker's category tabs.
// These invariants fail loudly if the catalog and the grouping drift apart.
describe("link-icons-tabler: TABLER_ICON_GROUPS", () => {
  const catalogKeys = new Set(Object.keys(TABLER_ICONS));
  const groupedKeys = TABLER_ICON_GROUPS.flatMap((g) => g.keys);

  it("references only keys that exist in the catalog", () => {
    const orphans = groupedKeys.filter((k) => !catalogKeys.has(k));
    assert.deepEqual(orphans, [], `grouped keys missing from TABLER_ICONS: ${orphans}`);
  });

  it("covers every catalog key exactly once", () => {
    const grouped = new Set(groupedKeys);
    const missing = [...catalogKeys].filter((k) => !grouped.has(k));
    assert.deepEqual(missing, [], `catalog keys not in any group: ${missing}`);
    assert.equal(
      groupedKeys.length,
      grouped.size,
      "a key appears in more than one group",
    );
  });

  it("gives every group a non-empty Persian label and id", () => {
    for (const g of TABLER_ICON_GROUPS) {
      assert.ok(g.id.length > 0, "group id is empty");
      assert.ok(g.label.length > 0, `group ${g.id} has empty label`);
      assert.ok(g.keys.length > 0, `group ${g.id} has no keys`);
    }
  });
});
