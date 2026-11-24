import test from "node:test";
import assert from "node:assert/strict";
import * as layout from "./scene3DData.js";

test("the active model contains only the approved third floor", () => {
  assert.ok(layout.floor3);
  assert.equal("floor4" in layout, false);
  assert.equal(layout.floor3.id, "floor-3");
});

test("third-floor table IDs and seat IDs are unique and capacities match", () => {
  const tables = layout.floor3.tables;
  assert.equal(tables.length, 24);
  assert.equal(new Set(tables.map(({ id }) => id)).size, tables.length);
  assert.equal(tables.reduce((count, table) => count + table.seats, 0), 154);
  for (const table of tables) assert.equal(table.chairPositions.length, table.seats, table.id);
  assert.ok(tables.some(({ id, label }) => id === "T14" && label.includes("T14")));
  assert.ok(tables.some(({ id, label }) => id === "T20" && label.includes("T20")));
});

test("offline layout still draws every seat without presenting it as bookable", () => {
  const seats = layout.buildSeatState(layout.floor3.tables, {}, layout.STATUS.UNKNOWN);
  assert.equal(Object.keys(seats).length, 154);
  assert.ok(Object.values(seats).every((status) => status === layout.STATUS.UNKNOWN));
});

test("tables use the same image-pixel-to-metre scale as the floor zones", () => {
  const leftPatioTable = layout.floor3.tables.find(({ id }) => id === "T1");
  const largeTable = layout.floor3.tables.find(({ id }) => id === "T6");
  assert.deepEqual(leftPatioTable.size, [0.6, 0.6]);
  assert.deepEqual(largeTable.size, [2, 0.48]);
  assert.ok(layout.floor3.floorZones.some(({ id }) => id === "left-patio"));
  assert.ok(layout.floor3.floorZones.some(({ id }) => id === "garden-patio"));
});

test("garden tables have eight separate chairs around their long sides", () => {
  for (const table of layout.floor3.tables.filter(({ id }) => /^T(?:1[7-9]|2[0-3])$/.test(id))) {
    const left = table.chairPositions.filter(([x]) => x < -0.5);
    const right = table.chairPositions.filter(([x]) => x > 0.5);
    const ends = table.chairPositions.filter(([x]) => Math.abs(x) < 0.01);
    assert.equal(left.length, 3, table.id);
    assert.equal(right.length, 3, table.id);
    assert.equal(ends.length, 2, table.id);
  }
});

test("the washroom partition reaches the T14 row and doors remain represented", () => {
  // Wall extended from pixel y=355 → y=400 so it reaches past T14 (centre y=375, south edge y=399)
  const x = (608 - 680) / 50;
  const zStart = (181 - 400) / 50;
  const zEnd   = (400 - 400) / 50;   // 0.0 — extended endpoint past T14
  assert.ok(
    layout.floor3.wallSegments.some(
      (wall) => wall.x1 === x && wall.x2 === x && wall.z1 === zStart && wall.z2 === zEnd,
    ),
    `Expected a vertical wall at world-x=${x} from z=${zStart} to z=${zEnd} (pixel x=608, y=181→400)`,
  );
  assert.ok(layout.floor3.doors.some(({ id }) => id === "entry-left"));
  assert.ok(layout.floor3.doors.some(({ id }) => id === "entry-right"));
});
