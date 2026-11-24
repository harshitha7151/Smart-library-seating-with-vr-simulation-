import test from "node:test";
import assert from "node:assert/strict";
import { bookingSchema, bookingWindowError, loginIdentifierSchema, loginRequestSchema, usnSchema } from "./validation.js";

test("USN validation accepts the RVCE format and normalizes letter case", () => {
  assert.equal(usnSchema.parse("1rv24is045"), "1RV24IS045");
  assert.equal(usnSchema.parse("1RV23EC021"), "1RV23EC021");
  for (const value of ["1RV24IS45", "1RV24IS0045", "2RV24IS045", "1RV24I1045", "1RV24IS0456"]) {
    assert.equal(usnSchema.safeParse(value).success, false, value);
  }
});

test("login identifier accepts either an email address or a USN", () => {
  assert.equal(loginIdentifierSchema.parse("1rv24is045"), "1RV24IS045");
  assert.equal(loginIdentifierSchema.parse("Student@RVCE.edu.in"), "student@rvce.edu.in");
  assert.equal(loginIdentifierSchema.safeParse("not-a-usn-or-email").success, false);
});

test("login request keeps the Unity email payload and accepts the browser USN payload", () => {
  assert.deepEqual(loginRequestSchema.parse({ email: "Student@RVCE.edu.in", password: "pw" }), {
    email: "student@rvce.edu.in", password: "pw", loginId: "student@rvce.edu.in",
  });
  assert.deepEqual(loginRequestSchema.parse({ loginId: "1rv24is045", password: "pw" }), {
    loginId: "1RV24IS045", password: "pw",
  });
  assert.equal(loginRequestSchema.safeParse({ email: "bad", password: "pw" }).success, false);
});

test("booking request validation accepts a stable third-floor seat ID", () => {
  assert.equal(bookingSchema.safeParse({
    seatId: "T14-S4",
    startAt: "2027-01-01T10:00:00.000Z",
    endAt: "2027-01-01T12:00:00.000Z",
  }).success, true);
});

test("booking request validation rejects other floors and malformed seat IDs", () => {
  assert.equal(bookingSchema.safeParse({ seatId: "T4-S4", startAt: "2027-01-01T10:00:00.000Z", endAt: "2027-01-01T11:00:00.000Z" }).success, true);
  assert.equal(bookingSchema.safeParse({ seatId: "floor4-T1-S1", startAt: "2027-01-01T10:00:00.000Z", endAt: "2027-01-01T11:00:00.000Z" }).success, false);
  assert.equal(bookingSchema.safeParse({ seatId: "T6-S0", startAt: "2027-01-01T10:00:00.000Z", endAt: "2027-01-01T11:00:00.000Z" }).success, false);
});

test("booking time limits reject past, reversed, long and far-future intervals", () => {
  const now = Date.parse("2026-11-01T00:00:00.000Z");
  const future = (hours) => new Date(now + hours * 60 * 60 * 1000);
  assert.equal(bookingWindowError(future(1), future(2), now), null);
  assert.match(bookingWindowError(future(-1), future(1), now), /future/);
  assert.match(bookingWindowError(future(2), future(1), now), /end time/);
  assert.match(bookingWindowError(future(1), future(6), now), /four hours/);
  assert.match(bookingWindowError(future(31 * 24), future(31 * 24 + 1), now), /30 days/);
});
