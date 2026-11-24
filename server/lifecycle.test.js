import test from "node:test";
import assert from "node:assert/strict";
import { checkInDecision, configuredCheckInGrace } from "./lifecycle.js";

test("check-in grace configuration defaults safely and supports short test windows", () => {
  assert.equal(configuredCheckInGrace(undefined), 10);
  assert.equal(configuredCheckInGrace("1"), 1);
  assert.equal(configuredCheckInGrace("0"), 0);
  assert.equal(configuredCheckInGrace("invalid"), 10);
  assert.equal(configuredCheckInGrace("90"), 10);
});

test("check-in is limited to the booking start and grace deadline", () => {
  const booking = {
    status: "confirmed",
    checkedInAt: null,
    startAt: new Date("2026-11-01T10:00:00Z"),
    checkInDeadline: new Date("2026-11-01T10:10:00Z"),
  };
  assert.equal(checkInDecision(booking, new Date("2026-11-01T09:59:59Z")), "too_early");
  assert.equal(checkInDecision(booking, new Date("2026-11-01T10:00:00Z")), null);
  assert.equal(checkInDecision(booking, new Date("2026-11-01T10:10:00Z")), null);
  assert.equal(checkInDecision(booking, new Date("2026-11-01T10:10:01Z")), "deadline_passed");
  assert.equal(checkInDecision({ ...booking, checkedInAt: new Date() }, new Date()), "already_checked_in");
  assert.equal(checkInDecision({ ...booking, status: "no_show" }, new Date()), "inactive");
});
