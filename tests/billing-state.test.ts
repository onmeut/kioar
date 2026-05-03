import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { evaluateTransitions } from "@/lib/billing-state";

type SubLike = Parameters<typeof evaluateTransitions>[0];

function baseSub(over: Partial<SubLike> = {}): SubLike {
  return {
    id: "sub-1",
    pageId: "page-1",
    planId: "plan-pro",
    billingCycle: "monthly",
    status: "active",
    currentPeriodStart: new Date(Date.UTC(2026, 3, 1)),
    currentPeriodEnd: new Date(Date.UTC(2026, 4, 1)),
    trialEndsAt: null,
    cancelAtPeriodEnd: false,
    pendingPlanChangePlanId: null,
    planKey: "pro",
    planNameFa: "پرو",
    priceMonthlyToman: 149_000,
    priceAnnualToman: 1_499_000,
    userId: "user-1",
    phone: "09120000000",
    ...over,
  } as SubLike;
}

const types = (cs: ReturnType<typeof evaluateTransitions>) =>
  cs.map((c) => c.type);

describe("evaluateTransitions — trialing branch", () => {
  const trialEnd = new Date(Date.UTC(2026, 4, 10));
  const sub = (over: Partial<SubLike> = {}) =>
    baseSub({ status: "trialing", trialEndsAt: trialEnd, ...over });

  it("fires trial_ending_in_3d exactly 3 days before trial end", () => {
    const now = new Date(Date.UTC(2026, 4, 7));
    assert.deepEqual(types(evaluateTransitions(sub(), now)), [
      "trial_ending_in_3d",
    ]);
  });

  it("does not fire 4 or 2 days before", () => {
    assert.equal(
      evaluateTransitions(sub(), new Date(Date.UTC(2026, 4, 6))).length,
      0,
    );
    assert.equal(
      evaluateTransitions(sub(), new Date(Date.UTC(2026, 4, 8))).length,
      0,
    );
  });

  it("fires trial_ending_today AND period_ended_to_grace on the trial end day", () => {
    const now = new Date(Date.UTC(2026, 4, 10, 1));
    assert.deepEqual(types(evaluateTransitions(sub(), now)), [
      "trial_ending_today",
      "period_ended_to_grace",
    ]);
  });

  it("trial-end with cancelAtPeriodEnd routes to cancel, not grace", () => {
    const now = new Date(Date.UTC(2026, 4, 10, 1));
    assert.deepEqual(
      types(evaluateTransitions(sub({ cancelAtPeriodEnd: true }), now)),
      ["trial_ending_today", "cancel_at_period_end_applied"],
    );
  });

  it("trial-end with pendingPlanChange routes to plan change", () => {
    const now = new Date(Date.UTC(2026, 4, 10, 1));
    assert.deepEqual(
      types(
        evaluateTransitions(sub({ pendingPlanChangePlanId: "plan-free" }), now),
      ),
      ["trial_ending_today", "pending_plan_change_applied"],
    );
  });
});

describe("evaluateTransitions — paid branch", () => {
  const sub = (over: Partial<SubLike> = {}) =>
    baseSub({ status: "active", ...over });

  it("fires period_ending_in_5d exactly 5 days before end", () => {
    const now = new Date(Date.UTC(2026, 3, 26));
    assert.deepEqual(types(evaluateTransitions(sub(), now)), [
      "period_ending_in_5d",
    ]);
  });

  it("fires period_ending_in_1d the day before end", () => {
    const now = new Date(Date.UTC(2026, 3, 30));
    assert.deepEqual(types(evaluateTransitions(sub(), now)), [
      "period_ending_in_1d",
    ]);
  });

  it("rolls into grace at period end", () => {
    const now = new Date(Date.UTC(2026, 4, 1, 1));
    assert.deepEqual(types(evaluateTransitions(sub(), now)), [
      "period_ended_to_grace",
    ]);
  });

  it("pending_renewal status follows the same rules", () => {
    const now = new Date(Date.UTC(2026, 4, 1, 1));
    assert.deepEqual(
      types(evaluateTransitions(sub({ status: "pending_renewal" }), now)),
      ["period_ended_to_grace"],
    );
  });

  it("cancel-at-period-end overrides grace at period end", () => {
    const now = new Date(Date.UTC(2026, 4, 1, 1));
    assert.deepEqual(
      types(evaluateTransitions(sub({ cancelAtPeriodEnd: true }), now)),
      ["cancel_at_period_end_applied"],
    );
  });

  it("pending plan change overrides grace at period end", () => {
    const now = new Date(Date.UTC(2026, 4, 1, 1));
    assert.deepEqual(
      types(
        evaluateTransitions(sub({ pendingPlanChangePlanId: "plan-free" }), now),
      ),
      ["pending_plan_change_applied"],
    );
  });
});

describe("evaluateTransitions — grace branch", () => {
  const sub = (over: Partial<SubLike> = {}) =>
    baseSub({ status: "grace", ...over });

  it("fires grace_ended_to_expired after the grace window", () => {
    // GRACE_PERIOD_DAYS = 7; period ended 2026-05-01.
    const now = new Date(Date.UTC(2026, 4, 8, 1));
    assert.deepEqual(types(evaluateTransitions(sub(), now)), [
      "grace_ended_to_expired",
    ]);
  });

  it("does not fire mid-grace", () => {
    const now = new Date(Date.UTC(2026, 4, 5));
    assert.equal(evaluateTransitions(sub(), now).length, 0);
  });
});

describe("evaluateTransitions — terminal statuses", () => {
  it("expired never fires anything", () => {
    const now = new Date(Date.UTC(2027, 0, 1));
    assert.equal(
      evaluateTransitions(baseSub({ status: "expired" }), now).length,
      0,
    );
  });

  it("canceled never fires anything", () => {
    const now = new Date(Date.UTC(2027, 0, 1));
    assert.equal(
      evaluateTransitions(baseSub({ status: "canceled" }), now).length,
      0,
    );
  });
});
