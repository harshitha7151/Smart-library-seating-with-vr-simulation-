// floorData.js
// Single source of truth for all floor map data.
// Tables, seats, rooms, paths — all defined here so SVG components stay clean.

// Seat status constants
export const STATUS = {
  AVAILABLE: "available",
  BOOKED: "booked",
  SELECTED: "selected",
};

// ─── 3rd Floor ──────────────────────────────────────────────────────────────
// SVG viewport: 900 × 680
// Layout mirrors the reference image:
//   • Outdoor seating column on the left (T1–T5, 4 seats each)
//   • Main indoor area centre-left (T6=14 seats big table, T7–T11 small tables)
//   • Office + Washrooms centre-top
//   • Reception centre-bottom
//   • Garden / outdoor corridor right (T17–T23, 8 seats each)
//   • Inner corridor tables (T12–T16, T24) stacked vertically centre-right

export const floor3Tables = [
  // ── Outdoor left column (T1–T5) ──
  { id: "T1",  label: "T1",  seats: 4, x: 52,  y: 130, outdoor: true },
  { id: "T2",  label: "T2",  seats: 4, x: 52,  y: 195, outdoor: true },
  { id: "T3",  label: "T3",  seats: 4, x: 52,  y: 260, outdoor: true },
  { id: "T4",  label: "T4",  seats: 4, x: 52,  y: 325, outdoor: true },
  { id: "T5",  label: "T5",  seats: 4, x: 52,  y: 390, outdoor: true },

  // ── Indoor small tables cluster (T7–T11) ──
  { id: "T7",  label: "T7",  seats: 4, x: 240, y: 120 },
  { id: "T8",  label: "T8",  seats: 4, x: 240, y: 200 },
  { id: "T9",  label: "T9",  seats: 4, x: 240, y: 280 },
  { id: "T10", label: "T10", seats: 4, x: 320, y: 120 },
  { id: "T10b",label: "T10",seats: 4, x: 320, y: 200 },  // image shows two rows at T10 position
  { id: "T11", label: "T11", seats: 4, x: 320, y: 280 },

  // ── Big table T6 (14 seats) ──
  { id: "T6",  label: "T6",  seats: 14, x: 195, y: 380, wide: true },

  // ── Right-side corridor tables (T12–T16, T24) ──
  { id: "T12", label: "T12", seats: 8, x: 530, y: 310 },
  { id: "T13", label: "T13", seats: 8, x: 530, y: 395 },
  { id: "T15", label: "T15", seats: 8, x: 530, y: 480 },
  { id: "T16", label: "T16", seats: 8, x: 530, y: 565 },
  { id: "T24", label: "T24", seats: 8, x: 530, y: 650 },

  // ── Outdoor garden right column (T17–T23) ──
  { id: "T17", label: "T17", seats: 8, x: 720, y: 80,  outdoor: true },
  { id: "T18", label: "T18", seats: 8, x: 720, y: 165, outdoor: true },
  { id: "T19", label: "T19", seats: 8, x: 720, y: 250, outdoor: true },
  { id: "T20", label: "T20", seats: 8, x: 720, y: 335, outdoor: true },
  { id: "T21", label: "T21", seats: 8, x: 720, y: 420, outdoor: true },
  { id: "T22", label: "T22", seats: 8, x: 720, y: 505, outdoor: true },
  { id: "T23", label: "T23", seats: 8, x: 720, y: 590, outdoor: true },
];

// ─── 4th Floor ──────────────────────────────────────────────────────────────
// SVG viewport: 900 × 480
// Layout:
//   • Office top-left (separate room)
//   • Large open reading area with big tables (left cluster, unlabelled in image)
//   • T1–T4 small tables (4 seats) centre
//   • Workshop bottom-centre
//   • Librarian Glass Office bottom-right
//   • Bookshelves along walls

export const floor4Tables = [
  // ── Big tables left cluster (unlabelled in image, estimated 8 seats each) ──
  { id: "F4-BL1", label: "BL1", seats: 8, x: 215, y: 105 },
  { id: "F4-BL2", label: "BL2", seats: 8, x: 215, y: 195 },
  { id: "F4-BL3", label: "BL3", seats: 8, x: 215, y: 285 },
  { id: "F4-BL4", label: "BL4", seats: 8, x: 215, y: 375 },

  // ── Small centre tables T1–T4 (4 seats each) ──
  { id: "F4-T1", label: "T1", seats: 4, x: 430, y: 130 },
  { id: "F4-T2", label: "T2", seats: 4, x: 530, y: 130 },
  { id: "F4-T3", label: "T3", seats: 4, x: 430, y: 240 },
  { id: "F4-T4", label: "T4", seats: 4, x: 530, y: 240 },
];

// ─── Sample booked seats (random selection for demo) ───────────────────────
export function buildInitialSeatState(tables) {
  const state = {};
  const bookedFraction = 0.3; // ~30% of seats pre-booked for demo realism
  tables.forEach((table) => {
    for (let i = 1; i <= table.seats; i++) {
      const sid = `${table.id}-S${i}`;
      state[sid] = Math.random() < bookedFraction ? STATUS.BOOKED : STATUS.AVAILABLE;
    }
  });
  return state;
}

// ─── Walkable path nodes (for future navigation) ────────────────────────────
// Each node has an id, x, y and connects to adjacent node ids.
// These trace the main aisles so a route-finding algorithm can later
// calculate a path from the entrance to any selected seat.
export const floor3PathNodes = [
  { id: "ENT3",   x: 460, y: 20,  connects: ["N3A"] },
  { id: "N3A",    x: 460, y: 70,  connects: ["ENT3", "N3B", "N3C"] },
  { id: "N3B",    x: 280, y: 70,  connects: ["N3A", "N3D"] },
  { id: "N3C",    x: 620, y: 70,  connects: ["N3A", "N3E"] },
  { id: "N3D",    x: 280, y: 360, connects: ["N3B"] },
  { id: "N3E",    x: 620, y: 360, connects: ["N3C", "N3F"] },
  { id: "N3F",    x: 620, y: 650, connects: ["N3E"] },
];

export const floor4PathNodes = [
  { id: "ENT4",   x: 390, y: 20,  connects: ["N4A"] },
  { id: "N4A",    x: 390, y: 80,  connects: ["ENT4", "N4B", "N4C"] },
  { id: "N4B",    x: 215, y: 80,  connects: ["N4A"] },
  { id: "N4C",    x: 560, y: 80,  connects: ["N4A"] },
];
