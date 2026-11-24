import test from "node:test";
import assert from "node:assert/strict";
import { createUnityLayout } from "./export-unity-layout.js";

test("Unity export preserves the approved third-floor layout and stable seat IDs", () => {
  const floor = createUnityLayout();
  const seats = floor.tables.flatMap((table) => table.seats);
  assert.equal(floor.floorNumber, 3);
  assert.equal(floor.tables.length, 24);
  assert.equal(seats.length, 154);
  assert.equal(new Set(seats.map((seat) => seat.id)).size, 154);
  assert.equal(seats.some((seat) => seat.id === "T14-S1"), true);
  assert.equal(seats.some((seat) => seat.id === "T20-S8"), true);
  assert.equal(floor.layout.walls.length > 0, true);
  assert.equal(floor.layout.doors.length > 0, true);
  assert.equal(floor.layout.shelves.length, 9);
});
